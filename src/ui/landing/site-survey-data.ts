// Demo readings sampled from /api/compare every 6 h over 30 days at DEMO_EPOCH.
// Window endpoints are hours from DEMO_EPOCH; zero-elevation crossings are interpolated.
type SurveyReading = {
  solarElevationDeg: number;
  sunlightWindows: readonly (readonly [number, number])[];
  earthVisibilityWindows: readonly (readonly [number, number])[];
};

export const SURVEY_HOURS = 720;
export const SITE_SURVEY: readonly SurveyReading[] = [
  { solarElevationDeg: 1.712, sunlightWindows: [[0, 720]], earthVisibilityWindows: [[74.79, 373.92]] },
  { solarElevationDeg: 1.836, sunlightWindows: [[0, 720]], earthVisibilityWindows: [[75.65, 373.54]] },
  { solarElevationDeg: -7.071, sunlightWindows: [[13.93, 369.5]], earthVisibilityWindows: [[0, 720]] },
];
