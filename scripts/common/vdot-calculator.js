/**
 * VDOT calculator based on heart rate zones
 */

class VDOTCalculator {
  constructor(maxHr, restingHr) {
    this.maxHr = maxHr;
    this.restingHr = restingHr;
    this.hrReserve = maxHr - restingHr;
  }

  /**
   * Get heart rate zone (1-5) based on percentage of max HR
   */
  getHrZone(avgHr) {
    if (avgHr <= 0) return 0;

    const hrPercent = (avgHr / this.maxHr) * 100;

    if (hrPercent < 70) return 1;      // Zone 1: <70% (轻松跑)
    if (hrPercent < 80) return 2;      // Zone 2: 70-80% (有氧基础)
    if (hrPercent < 87) return 3;      // Zone 3: 80-87% (节奏跑)
    if (hrPercent < 93) return 4;      // Zone 4: 87-93% (乳酸阈)
    return 5;                          // Zone 5: >93% (最大摄氧量)
  }

  /**
   * Calculate VDOT using Daniels Running Formula
   *
   * Based on Jack Daniels' "Daniels' Running Formula"
   * @param {number} distanceMeters - Distance in meters
   * @param {number} durationSeconds - Duration in seconds
   * @param {number} avgHr - Average heart rate (optional)
   * @returns {number|null} VDOT value
   */
  calculateVdotFromPace(distanceMeters, durationSeconds, avgHr = null) {
    if (durationSeconds <= 0 || distanceMeters <= 0) {
      return null;
    }

    // Convert to minutes
    const durationMinutes = durationSeconds / 60;

    // Velocity in m/min (required by Daniels formula)
    const velocityMPerMin = distanceMeters / durationMinutes;

    if (velocityMPerMin <= 0) return null;

    // Calculate VO2 using Daniels formula (velocity in m/min)
    // VO2 = -4.60 + 0.182258 * v + 0.000104 * v²
    const vo2 = -4.60 + 0.182258 * velocityMPerMin + 0.000104 * (velocityMPerMin ** 2);

    // Calculate percent of VO2max based on duration (standard Daniels formula)
    // %VO2max = 0.8 + 0.1894393 * e^(-0.012778*t) + 0.2989558 * e^(-0.1932605*t)
    const t = durationMinutes;
    const percentVo2max = 0.8
                        + 0.1894393 * Math.exp(-0.012778 * t)
                        + 0.2989558 * Math.exp(-0.1932605 * t);

    // Sanity check
    if (percentVo2max <= 0 || percentVo2max > 1.0) return null;

    // Calculate base VDOT
    let vdot = vo2 / percentVo2max;

    // Optional: Adjust VDOT based on heart rate zone
    // This accounts for efficiency differences (lower HR at same pace = better fitness)
    if (avgHr && avgHr > 0) {
      const hrZone = this.getHrZone(avgHr);

      // Conservative multipliers based on HR efficiency
      const zoneMultipliers = {
        1: 0.97,  // Easy run - may indicate overtraining or inefficiency if too many easy runs
        2: 0.99,  // Aerobic base - good aerobic fitness
        3: 1.00,  // Tempo run - baseline
        4: 1.00,  // Lactate threshold - expected for this pace
        5: 1.00   // VO2max - expected for hard efforts
      };

      const multiplier = zoneMultipliers[hrZone] || 1.0;
      vdot *= multiplier;
    }

    // Sanity check: VDOT typically ranges from 30-85 for most runners
    if (vdot < 20 || vdot > 100) {
      return null;
    }

    return Math.round(vdot * 10) / 10;
  }

  /**
   * Calculate training load based on duration and heart rate
   */
  calculateTrainingLoad(durationSeconds, avgHr = null) {
    if (durationSeconds <= 0) return 0;

    const durationHours = durationSeconds / 3600;

    // Base load from duration
    let baseLoad = durationHours * 100;

    // Adjust by HR zone if available
    if (avgHr && avgHr > 0) {
      const hrZone = this.getHrZone(avgHr);

      // Zone factors for training load
      const zoneFactors = {
        1: 0.6,   // Easy recovery
        2: 0.8,   // Aerobic base
        3: 1.0,   // Tempo
        4: 1.3,   // Threshold
        5: 1.5    // VO2max
      };

      const factor = zoneFactors[hrZone] || 1.0;
      baseLoad *= factor;
    }

    return Math.round(baseLoad);
  }

  /**
   * Analyze heart rate distribution across zones
   */
  analyzeHrDistribution(hrRecords) {
    if (!hrRecords || hrRecords.length === 0) {
      return {};
    }

    const zoneCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    for (const hr of hrRecords) {
      if (hr > 0) {
        const zone = this.getHrZone(hr);
        if (zone in zoneCounts) {
          zoneCounts[zone]++;
        }
      }
    }

    const total = Object.values(zoneCounts).reduce((a, b) => a + b, 0);
    if (total === 0) return {};

    const distribution = {};
    for (const [zone, count] of Object.entries(zoneCounts)) {
      distribution[`zone_${zone}`] = (count / total) * 100;
    }

    return distribution;
  }
}

module.exports = VDOTCalculator;
