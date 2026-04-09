/**
 * Garmin Connect API client
 * 支持 access_token 过期时使用 refresh_token 自动刷新
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const GARMIN_TOKEN_URL = 'https://diauth.garmin.com/di-oauth2-service/oauth/token';

class GarminClient {
  constructor(authToken) {
    this.authToken = authToken;
    this.baseUrl = 'https://connectapi.garmin.com';

    // Parse auth token (Base64 encoded JSON array)
    try {
      const decoded = Buffer.from(authToken, 'base64').toString('utf-8');
      const authData = JSON.parse(decoded);

      // authData is [oauth_token_data, oauth2_token_data]
      this.oauthToken = authData[0];
      this.oauth2Token = authData[1];

      this.accessToken = this.oauth2Token.access_token;
    } catch (error) {
      throw new Error(`Failed to parse GARMIN_SECRET_STRING: ${error.message}`);
    }

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 240000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Authorization': `Bearer ${this.accessToken}`,
        'origin': 'https://sso.garmin.com',
        'nk': 'NT'
      }
    });
  }

  /**
   * 使用 refresh_token 刷新 access_token
   * 若 Garmin 要求 client 认证，可在 .env 中设置 GARMIN_CLIENT_ID、GARMIN_CLIENT_SECRET（需在 Garmin 开发者门户注册应用）
   * @returns {Promise<string|null>} 新的 Base64 编码的完整 token，失败返回 null
   */
  async refreshAccessToken() {
    const refreshToken = this.oauth2Token && this.oauth2Token.refresh_token;
    if (!refreshToken) {
      console.error('无法刷新: token 中缺少 refresh_token，请使用 python scripts/get_garmin_token.py 重新获取');
      return null;
    }
    try {
      const form = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      });
      const clientId = process.env.GARMIN_CLIENT_ID;
      const clientSecret = process.env.GARMIN_CLIENT_SECRET;
      if (clientId) form.set('client_id', clientId);
      if (clientSecret) form.set('client_secret', clientSecret);

      const res = await axios.post(GARMIN_TOKEN_URL, form.toString(), {
        timeout: 15000,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'origin': 'https://sso.garmin.com'
        }
      });
      const data = res.data;
      const now = Math.floor(Date.now() / 1000);
      this.oauth2Token = {
        ...this.oauth2Token,
        access_token: data.access_token,
        refresh_token: data.refresh_token || refreshToken,
        expires_in: data.expires_in,
        expires_at: data.expires_at || (now + (data.expires_in || 86400))
      };
      this.accessToken = this.oauth2Token.access_token;
      this.client.defaults.headers.common['Authorization'] = `Bearer ${this.accessToken}`;
      const newPayload = Buffer.from(JSON.stringify([this.oauthToken, this.oauth2Token])).toString('base64');
      return newPayload;
    } catch (err) {
      const msg = err.response ? `${err.response.status} ${JSON.stringify(err.response.data)}` : err.message;
      console.error(`Token 刷新失败: ${msg}`);
      console.error('请运行 python scripts/get_garmin_token.py 重新获取 token，并更新 .env 中的 GARMIN_SECRET_STRING');
      return null;
    }
  }

  /**
   * 将新 token 写回 .env（若存在且可写）
   */
  async _persistTokenToEnv(newToken) {
    const envPath = path.join(process.cwd(), '.env');
    try {
      let content = await fs.readFile(envPath, 'utf-8');
      if (/^\s*GARMIN_SECRET_STRING\s*=/.m.test(content)) {
        content = content.replace(/^(GARMIN_SECRET_STRING\s*=).*$/m, `$1${newToken}`);
      } else {
        content = content.trimEnd() + (content.endsWith('\n') ? '' : '\n') + `GARMIN_SECRET_STRING=${newToken}\n`;
      }
      await fs.writeFile(envPath, content, 'utf-8');
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * 请求时若 401 则尝试刷新 token 并重试一次
   */
  async _requestWithRefresh(fn) {
    try {
      return await fn();
    } catch (error) {
      if (error.response && error.response.status === 401) {
        const newToken = await this.refreshAccessToken();
        if (newToken) {
          process.env.GARMIN_SECRET_STRING = newToken;
          const persisted = await this._persistTokenToEnv(newToken);
          if (persisted) {
            console.log('已用 refresh_token 刷新 access_token，并已更新 .env');
          } else {
            console.log('已用 refresh_token 刷新 access_token。若需持久化，请将下方新 token 写入 .env 的 GARMIN_SECRET_STRING：');
            console.log(newToken);
          }
          return await fn();
        }
      }
      throw error;
    }
  }

  /**
   * Get list of activities
   */
  async getActivities(start = 0, limit = 100) {
    const url = `/activitylist-service/activities/search/activities?start=${start}&limit=${limit}`;
    return this._requestWithRefresh(async () => {
      const response = await this.client.get(url);
      return response.data;
    }).catch((error) => {
      console.error(`Error fetching activities: ${error.message}`);
      if (error.response) {
        console.error(`Status: ${error.response.status}`);
        console.error(`Data: ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    });
  }

  /**
   * Get activity details by ID（用于调试：查看详情接口是否返回 sportType/subType 等）
   */
  async getActivityDetails(activityId) {
    try {
      const url = `/activity-service/activity/${activityId}`;
      const response = await this.client.get(url);
      return response.data;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Download FIT file for an activity
   */
  async downloadFitFile(activityId) {
    try {
      return await this._requestWithRefresh(async () => {
        const url = `/download-service/files/activity/${activityId}`;
        const response = await this.client.get(url, {
          responseType: 'arraybuffer'
        });
        return response.data;
      });
    } catch (error) {
      console.error(`Error downloading FIT file for activity ${activityId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Check if token is valid
   */
  async checkAuth() {
    try {
      await this.getActivities(0, 1);
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = GarminClient;
