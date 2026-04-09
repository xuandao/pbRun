"""
Garmin Token 工具测试
"""
import sys
import os
import unittest
from unittest.mock import Mock, patch, MagicMock, mock_open
from io import StringIO

# Add scripts/garmin to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'scripts', 'garmin'))

from get_garmin_token import _load_dotenv


class TestLoadDotenv(unittest.TestCase):
    """测试 .env 文件加载功能"""

    @patch('os.path.isfile')
    @patch('builtins.open', mock_open(read_data='GARMIN_EMAIL=test@example.com\nGARMIN_PASSWORD=secret123\n'))
    def test_load_env_file(self, mock_isfile):
        """测试加载 .env 文件"""
        mock_isfile.return_value = True
        with patch.dict('os.environ', {}, clear=True):
            _load_dotenv()
            self.assertEqual(os.environ.get('GARMIN_EMAIL'), 'test@example.com')
            self.assertEqual(os.environ.get('GARMIN_PASSWORD'), 'secret123')

    @patch('os.path.isfile')
    @patch('builtins.open', mock_open(read_data='# Comment line\n\nKEY=value\n'))
    def test_skip_comments_and_empty_lines(self, mock_isfile):
        """测试跳过注释和空行"""
        mock_isfile.return_value = True
        with patch.dict('os.environ', {}, clear=True):
            _load_dotenv()
            self.assertEqual(os.environ.get('KEY'), 'value')
            self.assertIsNone(os.environ.get('# Comment line'))

    @patch('os.path.isfile')
    @patch('builtins.open', mock_open(read_data='QUOTED="quoted_value"\nSINGLE=\'single_value\'\n'))
    def test_handle_quoted_values(self, mock_isfile):
        """测试处理带引号的值"""
        mock_isfile.return_value = True
        with patch.dict('os.environ', {}, clear=True):
            _load_dotenv()
            self.assertEqual(os.environ.get('QUOTED'), 'quoted_value')
            self.assertEqual(os.environ.get('SINGLE'), 'single_value')

    @patch('os.path.isfile')
    def test_no_env_file(self, mock_isfile):
        """测试没有 .env 文件的情况"""
        mock_isfile.return_value = False
        # 不应抛出异常
        _load_dotenv()


class TestMainFunction(unittest.TestCase):
    """测试主函数"""

    @patch('get_garmin_token._load_dotenv')
    @patch('builtins.input', return_value='test@example.com')
    @patch('getpass.getpass', return_value='password123')
    @patch('garth.login')
    @patch('garth.client.dumps', return_value='mock_token_string')
    def test_successful_authentication(self, mock_dumps, mock_login, mock_getpass, mock_input, mock_load_env):
        """测试成功认证"""
        from get_garmin_token import main
        result = main()
        self.assertEqual(result, 0)
        mock_login.assert_called_once()
        mock_dumps.assert_called_once()

    @patch('get_garmin_token._load_dotenv')
    @patch.dict('os.environ', {'GARMIN_EMAIL': 'env@example.com', 'GARMIN_PASSWORD': 'envpass'})
    @patch('garth.login')
    @patch('garth.client.dumps', return_value='mock_token')
    def test_use_env_credentials(self, mock_dumps, mock_login, mock_load_env):
        """测试使用环境变量中的凭据"""
        from get_garmin_token import main
        result = main()
        self.assertEqual(result, 0)
        mock_login.assert_called_with('env@example.com', 'envpass')

    @patch('get_garmin_token._load_dotenv')
    @patch('builtins.input', return_value='')
    @patch('getpass.getpass', return_value='')
    def test_missing_credentials(self, mock_getpass, mock_input, mock_load_env):
        """测试缺少凭据"""
        with patch.dict('os.environ', {}, clear=True):
            from get_garmin_token import main
            result = main()
            self.assertEqual(result, 1)

    @patch('get_garmin_token._load_dotenv')
    @patch.dict('os.environ', {'GARMIN_EMAIL': 'test@test.com', 'GARMIN_PASSWORD': 'pass'})
    @patch('garth.login', side_effect=Exception('Auth failed'))
    def test_authentication_failure(self, mock_login, mock_load_env):
        """测试认证失败"""
        from get_garmin_token import main
        result = main()
        self.assertEqual(result, 1)


if __name__ == '__main__':
    unittest.main()
