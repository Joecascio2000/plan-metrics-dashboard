/**
 * ==============================================================================
 * Chaffey College - Institutional Plan Metrics & Goal-Tracking Dashboard
 * ==============================================================================
 *
 * Core Client-Side Application Architecture:
 * 1. Data Parsing & Handling (SheetJS - Reads strictly from master sheet)
 * 2. Data Normalization & Plan Grouping (EMP, Strategic Plan 2026-2030, Report Card)
 * 3. Dynamic Calculation Engine (Baseline, Latest Actual, Target, Variance/Gap, Trend)
 * 4. Filtering System (Cascading Category & Goal, Modality, Pillar, Format, Search)
 * 5. Interactive Visualization (Chart.js responsive trend lines & target horizons)
 * 6. Alert Detection ("Highlight At-Risk Metrics" toggle & institutional warnings)
 * 7. Export Engine (html2canvas for PNG and jsPDF for PDF document generation)
 * 8. Theme Management (Light / Dark mode synchronized with chart palettes)
 */

(function () {
  'use strict';

  // ============================================================================
  // Constant Definitions & Schema Keys
  // ============================================================================

  const HISTORICAL_YEARS = [
    '2020-2021',
    '2021-2022',
    '2022-2023',
    '2023-2024',
    '2024-2025',
    '2025-2026'
  ];

  // Dual-unit metrics where Report Card tracks headcount and Strategic Plan tracks proportions
  const DUAL_UNIT_METRIC_IDS = ['M-024', 'M-025', 'M-035', 'M-036'];

  // ============================================================================
  // Configuration Settings (Configurable feature toggles)
  // ============================================================================
  const CONFIG = {
    // Show or hide references to Ongoing Report Card (navigation tab, card pill icons, etc.)
    showOngoingReportCard: false,

    // When Report Card is hidden, whether metrics only belonging to Report Card appear in 'All Plans' tab
    includeReportCardOnlyMetricsWhenHidden: false
  };

  const PLAN_DEFINITIONS = {
    'Educational Master Plan': {
      title: 'Educational Master Plan (EMP)',
      desc: 'Tracking long-range educational capacity, scheduling efficiency, course success, and equitable student access aligned with Chaffey College 2025–2026 baseline horizons.',
      baselineCol: 'EMP Baseline (2025-2026 Yr 0)',
      targetCol: 'EMP Target Goal',
      goalCol: 'EMP Goal',
      areaCol: 'EMP Plan Area(s) (Values separated with ";")',
      tags: ['Baseline: 2025-2026 (Yr 0)', 'EMP Target Goals', 'Long-Range Educational Planning']
    },
    'Strategic Plan (2026-2030)': {
      title: 'Strategic Plan (2026–2030)',
      desc: 'Institutional 5-year strategic goals centered on Student Success, Ensured Learning, Career Pathways, and Inclusive Equity with 2024–2025 Year 0 baselines.',
      baselineCol: 'Strategic Plan Baseline (2024-2025 Yr 0)',
      targetCol: 'Strategic Plan Target Goal (2026-2030)',
      goalCol: 'Strategic Plan Goal',
      areaCol: 'Strategic Plan Objective',
      tags: ['Baseline: 2024-2025 (Yr 0)', '2026-2030 Target Horizons', '4 Strategic Goals']
    },
    'Ongoing Report Card': {
      title: 'Ongoing Report Card',
      desc: 'Annual institutional health metrics monitoring multi-year district performance, enrollment trends, persistence, and degree/certificate completions.',
      baselineCol: '2020-2021',
      targetCol: null, // Report Card tracks baseline trends; no artificial target imposed
      goalCol: 'EMP Goal',
      areaCol: 'EMP Plan Area(s) (Values separated with ";")',
      tags: ['6-Year Historical Trends', 'Districtwide Performance', 'Annual Report Card Tracking']
    },
    'BOTH': {
      title: 'Overlapping Institutional Plan Metrics (EMP & Strategic Plan)',
      desc: 'Shared core metrics concurrently included in both the Educational Master Plan (EMP) and Strategic Plan (2026–2030).',
      baselineCol: 'Strategic Plan Baseline (2024-2025 Yr 0)',
      targetCol: 'Strategic Plan Target Goal (2026-2030)',
      goalCol: 'Strategic Plan Goal',
      areaCol: 'Strategic Plan Objective',
      tags: ['Cross-Plan Overlap', 'Shared EMP & Strategic Plan Priorities', 'Institutional Core']
    },
    'ALL': {
      title: 'All Institutional Plans (Unified Master View)',
      desc: 'Cross-functional institutional matrix unifying metrics across the Educational Master Plan and Strategic Plan (2026–2030).',
      baselineCol: 'EMP Baseline (2025-2026 Yr 0)',
      targetCol: 'EMP Target Goal',
      goalCol: 'EMP Goal',
      areaCol: 'EMP Plan Area(s) (Values separated with ";")',
      tags: ['Unified Institutional Plans', 'Cross-Plan Taxonomy', 'Strategic & EMP Alignment']
    }
  };

  // ============================================================================
  // Global Application State
  // ============================================================================

  const state = {
    rawMetrics: [],          // Raw rows parsed strictly from master sheet
    normalizedMetrics: [],   // Enriched with calculations, trends, and parsed numbers
    activePlan: 'ALL',       // Default active plan tab: All Plans Master View (Requirement 2)
    activeFilters: {
      search: '',
      category: '',
      pillar: '',
      goal: '',
      area: '',
      modality: '',
      initiative: '',
      status: '',
      quickChip: 'all'
    },
    highlightAtRisk: false,  // "Highlight At-Risk Metrics" toggle state (shows only at-risk metrics when true)
    theme: localStorage.getItem('chaffey_theme') || 'light',
    chartInstances: new Map(), // Canvas ID -> Chart.js instance
    modalChartInstance: null,
    viewMode: 'grid'         // 'grid' or 'list'
  };

  // ============================================================================
  // DOM Element Selectors
  // ============================================================================

  const elements = {
    // Header & Actions
    atRiskToggle: document.getElementById('atRiskToggle'),
    exportDropdownBtn: document.getElementById('exportDropdownBtn'),
    exportMenu: document.getElementById('exportMenu'),
    exportPngBtn: document.getElementById('exportPngBtn'),
    exportPdfBtn: document.getElementById('exportPdfBtn'),
    uploadTriggerBtn: document.getElementById('uploadTriggerBtn'),
    spreadsheetFileInput: document.getElementById('spreadsheetFileInput'),
    themeToggleBtn: document.getElementById('themeToggleBtn'),

    // Upload & Drop Zone
    uploadDropZone: document.getElementById('uploadDropZone'),
    browseFileBtn: document.getElementById('browseFileBtn'),
    currentFileBadge: document.getElementById('currentFileBadge'),

    // Plan Navigation & Horizon
    planTabs: document.querySelectorAll('.plan-tab'),
    planHorizonBanner: document.getElementById('planHorizonBanner'),
    planTitleDisplay: document.getElementById('planTitleDisplay'),
    planDescDisplay: document.getElementById('planDescDisplay'),
    horizonTags: document.getElementById('horizonTags'),

    // Plan Count Pills
    empCountPill: document.getElementById('empCountPill'),
    spCountPill: document.getElementById('spCountPill'),
    rcCountPill: document.getElementById('rcCountPill'),
    allCountPill: document.getElementById('allCountPill'),
    bothCountPill: document.getElementById('bothCountPill'),

    // KPI Summary
    kpiHealthPercent: document.getElementById('kpiHealthPercent'),
    kpiHealthCircle: document.getElementById('kpiHealthCircle'),
    kpiHealthHeadline: document.getElementById('kpiHealthHeadline'),
    kpiHealthDetail: document.getElementById('kpiHealthDetail'),
    kpiTotalMetrics: document.getElementById('kpiTotalMetrics'),
    kpiTotalSub: document.getElementById('kpiTotalSub'),
    kpiTotalCard: document.getElementById('kpiTotalCard'),
    kpiOnTrackCount: document.getElementById('kpiOnTrackCount'),
    kpiOnTrackPct: document.getElementById('kpiOnTrackPct'),
    kpiOnTrackCard: document.getElementById('kpiOnTrackCard'),
    kpiAtRiskCount: document.getElementById('kpiAtRiskCount'),
    kpiAtRiskPct: document.getElementById('kpiAtRiskPct'),
    kpiAtRiskCard: document.getElementById('kpiAtRiskCard'),
    kpiGoalsMetCount: document.getElementById('kpiGoalsMetCount'),
    kpiGoalsMetSub: document.getElementById('kpiGoalsMetSub'),
    kpiGoalsMetCard: document.getElementById('kpiGoalsMetCard'),
    kpiAvgProgress: document.getElementById('kpiAvgProgress'),
    kpiAvgProgressBar: document.getElementById('kpiAvgProgressBar'),

    // Sidebar & Collapsible Controls
    dashboardSidebar: document.getElementById('dashboardSidebar'),
    collapseSidebarBtn: document.getElementById('collapseSidebarBtn'),
    expandSidebarBtn: document.getElementById('expandSidebarBtn'),

    // Filter Controls
    metricSearchInput: document.getElementById('metricSearchInput'),
    searchClearBtn: document.getElementById('searchClearBtn'),
    categoryFilter: document.getElementById('categoryFilter'),
    pillarFilter: document.getElementById('pillarFilter'),
    goalFilter: document.getElementById('goalFilter'),
    areaFilter: document.getElementById('areaFilter'),
    modalityFilter: document.getElementById('modalityFilter'),
    initiativeFilter: document.getElementById('initiativeFilter'),
    statusFilter: document.getElementById('statusFilter'),
    resetFiltersBtn: document.getElementById('resetFiltersBtn'),
    filterActiveCount: document.getElementById('filterActiveCount'),
    quickChips: document.querySelectorAll('.chip-btn'),

    // Metrics Display
    metricsGridContainer: document.getElementById('metricsGridContainer'),
    displayedMetricsCount: document.getElementById('displayedMetricsCount'),
    emptyState: document.getElementById('emptyState'),
    emptyResetBtn: document.getElementById('emptyResetBtn'),
    viewGridBtn: document.getElementById('viewGridBtn'),
    viewListBtn: document.getElementById('viewListBtn'),
    dashboardCaptureTarget: document.getElementById('dashboardCaptureTarget'),

    // Modal Details Inspector
    metricDetailModal: document.getElementById('metricDetailModal'),
    modalCloseBtn: document.getElementById('modalCloseBtn'),
    modalCloseFooterBtn: document.getElementById('modalCloseFooterBtn'),
    modalMetricId: document.getElementById('modalMetricId'),
    modalStatusBadge: document.getElementById('modalStatusBadge'),
    modalUnitBadge: document.getElementById('modalUnitBadge'),
    modalMetricName: document.getElementById('modalMetricName'),
    modalLatestActual: document.getElementById('modalLatestActual'),
    modalLatestYear: document.getElementById('modalLatestYear'),
    modalTargetGoal: document.getElementById('modalTargetGoal'),
    modalTargetLabel: document.getElementById('modalTargetLabel'),
    modalBaselineValue: document.getElementById('modalBaselineValue'),
    modalBaselineLabel: document.getElementById('modalBaselineLabel'),
    modalGapValue: document.getElementById('modalGapValue'),
    modalGapSub: document.getElementById('modalGapSub'),
    modalForecastSection: document.getElementById('modalForecastSection'),
    modalForecastYearsRemaining: document.getElementById('modalForecastYearsRemaining'),
    modalForecastTrajectory: document.getElementById('modalForecastTrajectory'),
    modalForecastTrajectorySub: document.getElementById('modalForecastTrajectorySub'),
    modalForecastProjected: document.getElementById('modalForecastProjected'),
    modalForecastTargetCompare: document.getElementById('modalForecastTargetCompare'),
    modalForecastRequiredPace: document.getElementById('modalForecastRequiredPace'),
    modalForecastPaceStatus: document.getElementById('modalForecastPaceStatus'),
    modalForecastVerdictBox: document.getElementById('modalForecastVerdictBox'),
    modalForecastVerdictIcon: document.getElementById('modalForecastVerdictIcon'),
    modalForecastVerdictText: document.getElementById('modalForecastVerdictText'),
    modalForecastPathwayContainer: document.getElementById('modalForecastPathwayContainer'),
    modalForecastPathwaySteps: document.getElementById('modalForecastPathwaySteps'),
    modalTrendCanvas: document.getElementById('modalTrendCanvas'),
    modalHistoryTable: document.getElementById('modalHistoryTable'),
    modalDefinition: document.getElementById('modalDefinition'),
    modalPillar: document.getElementById('modalPillar'),
    modalPlanAlignment: document.getElementById('modalPlanAlignment'),
    modalGoalArea: document.getElementById('modalGoalArea'),
    modalDataSource: document.getElementById('modalDataSource'),
    modalResponsible: document.getElementById('modalResponsible'),
    modalDisaggregation: document.getElementById('modalDisaggregation'),
    modalNotes: document.getElementById('modalNotes'),
    modalInitiativeBadges: document.getElementById('modalInitiativeBadges'),
    modalDatePulled: document.getElementById('modalDatePulled'),

    // Toast Container
    toastContainer: document.getElementById('toastContainer')
  };

  // ============================================================================
  // Initialization & Bootstrapping
  // ============================================================================

  function init() {
    setupTheme();
    applyConfig();
    setupEventListeners();

    // Load initial data: Pre-compiled dataset from master sheet if available
    if (window.DEFAULT_PLAN_METRICS && Array.isArray(window.DEFAULT_PLAN_METRICS) && window.DEFAULT_PLAN_METRICS.length > 0) {
      processMasterSheetData(window.DEFAULT_PLAN_METRICS, 'unified_plan_metrics_template.xlsx');
    } else {
      showToast('Ready for spreadsheet upload. Drag & drop or browse.', 'info');
    }
  }

  function applyConfig() {
    // Show or hide Ongoing Report Card tab dynamically based on CONFIG
    const rcTab = document.getElementById('tab-rc') || document.querySelector('[data-plan="Ongoing Report Card"]');
    if (rcTab) {
      rcTab.style.display = CONFIG.showOngoingReportCard ? 'inline-flex' : 'none';
    }
  }

  // ============================================================================
  // Theme Management (Synchronized with Chart.js)
  // ============================================================================

  function setupTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
  }

  function toggleTheme() {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', state.theme);
    localStorage.setItem('chaffey_theme', state.theme);

    // Refresh all rendered Chart.js instances to update grid lines & tick colors
    refreshAllCharts();
  }

  function getChartThemeColors() {
    const isDark = state.theme === 'dark';
    return {
      gridColor: isDark ? 'rgba(51, 65, 85, 0.45)' : 'rgba(226, 232, 240, 0.8)',
      textColor: isDark ? '#94a3b8' : '#64748b',
      tooltipBg: isDark ? '#020617' : '#0f172a',
      lineColor: '#990000',
      targetLineColor: isDark ? '#38bdf8' : '#0284c7',
      baselineLineColor: isDark ? '#94a3b8' : '#64748b'
    };
  }

  // ============================================================================
  // 1. Data Parsing & Handling (SheetJS Integration)
  // ============================================================================

  /**
   * Handles user spreadsheet file upload (.xlsx, .xls, .csv).
   * Reads STRICTLY from the primary 'master' sheet as instructed.
   */
  function handleFileUpload(file) {
    if (!file) return;

    const fileName = file.name;
    const reader = new FileReader();

    showToast(`Parsing spreadsheet: ${fileName}...`, 'info');

    reader.onload = function (e) {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        // Locate strictly the 'master' sheet (case-insensitive)
        let masterSheetName = workbook.SheetNames.find(
          name => name.trim().toLowerCase() === 'master'
        );

        if (!masterSheetName) {
          console.warn("'master' sheet not found by name. Checking first sheet.");
          masterSheetName = workbook.SheetNames[0];
          showToast(`Note: 'master' sheet not found; reading primary sheet '${masterSheetName}'.`, 'info');
        }

        const worksheet = workbook.Sheets[masterSheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: null });

        if (!rawJson || rawJson.length === 0) {
          showToast(`Error: The '${masterSheetName}' sheet appears to be empty.`, 'error');
          return;
        }

        // Filter out empty trailing rows that lack Metric ID
        const validRows = rawJson.filter(row => {
          const id = row['Metric ID'];
          return id && String(id).trim().length > 0;
        });

        processMasterSheetData(validRows, fileName);
        showToast(`Successfully loaded ${validRows.length} metrics from '${masterSheetName}' sheet!`, 'success');
      } catch (err) {
        console.error('Spreadsheet parsing error:', err);
        showToast(`Failed to parse spreadsheet: ${err.message}`, 'error');
      }
    };

    reader.onerror = function () {
      showToast('Error reading uploaded file.', 'error');
    };

    reader.readAsArrayBuffer(file);
  }

  // ============================================================================
  // 2. Data Normalization & Calculated Fields Engine
  // ============================================================================

  /**
   * Normalizes raw spreadsheet rows and calculates institutional metrics:
   * - Plan memberships
   * - Semicolon-split Goals and Plan Areas (Requirement 5)
   * - Latest actuals, prior actuals, and baseline values
   * - Target goal parsing (numeric, percentages, or growth rates)
   * - Numerical Gap / Variance
   * - Progress toward target %
   * - Goal Status ("On Track", "Off Track", "Goal Met", "Tracking")
   */
  function processMasterSheetData(rows, sourceName) {
    state.rawMetrics = rows;

    const validRows = (rows || []).filter(r => r && (String(r['Metric ID'] || '').trim() || String(r['Unified Metric Name'] || r['Metric Name'] || '').trim()));

    state.normalizedMetrics = validRows.map(row => {
      const id = String(row['Metric ID'] || '').trim();
      const name = String(row['Unified Metric Name'] || row['Metric Name'] || 'Unnamed Metric').trim();
      const plansField = String(row['Included in Master Plan(s) (Values separated with ";")'] || '');
      const plans = plansField.split(';').map(p => p.trim()).filter(Boolean);

      const categoryField = String(row['Metric Category(s) (Values separated with ";")'] || '');
      const categories = categoryField.split(';').map(c => c.trim()).filter(Boolean);

      const parentGroup = String(row['Parent Metric / Group(s) (Values separated with ";")'] || '');
      const subgroup = String(row['Disaggregation / Sub-Group'] || '').trim();
      const unitFormat = String(row['Metric Unit / Format'] || 'Count').trim();
      const definition = String(row['Metric Definition'] || 'No formal definition provided.').trim();
      const dataSource = String(row['Data Source(s) (Values separated with ";")'] || 'Institutional Research').trim();
      const responsible = String(row['Responsible Party(s) (Values separated with ";")'] || 'Institutional Research').trim();
      const pillar = String(row['Guided Pathways Alignment'] || 'Institutional Support').trim();
      const notes = String(row['Notes & Methodology Nuances'] || '').trim();

      // Flexible column resolution for updated/renamed target & baseline fields
      const empBaselineRaw = row['EMP Baseline (2025-2026 Yr 0)'] ?? row['EMP Baseline'];
      const empTargetRaw = row['EMP Target Goal (By 2030)'] ??
                           row['EMP Target Goal (By YYYY)'] ??
                           row['EMP Target Goal'] ??
                           row['EMP Target'];
      const spBaselineRaw = row['Strategic Plan Baseline (2024-2025 Yr 0)'] ?? row['Strategic Plan Baseline'];
      const spTargetRaw = row['Strategic Plan Target Goal (By 2030)'] ??
                          row['Strategic Plan Target Goal (2026-2030)'] ??
                          row['Strategic Plan Target Goal'] ??
                          row['Strategic Plan Target'];

      // Institutional Initiative Alignment columns & pull date
      const datePulled = row['Date Pulled'] ? String(row['Date Pulled']).trim() : null;
      const accjc = String(row['ACCJC Standards'] || '').trim().toUpperCase() === 'Y';
      const strongWorkforce = String(row['Strong Workforce'] || '').trim().toUpperCase() === 'Y';
      const scff = String(row['Student Centered Funding Formula'] || '').trim().toUpperCase() === 'Y' ||
                   String(row['Metric Trait(s) / Initiative Alignment (Values separated with ";")'] || '').toLowerCase().includes('scff');
      const sea = String(row['Student Equity & Achievement'] || '').trim().toUpperCase() === 'Y';
      const vision2030 = String(row['Vision 2030'] || '').trim().toUpperCase() === 'Y';

      // Semicolon-split Goals & Areas (Requirement 5)
      const empGoals = String(row['EMP Goal'] || '').split(';').map(g => g.trim()).filter(Boolean);
      const spGoals = String(row['Strategic Plan Goal'] || '').split(';').map(g => g.trim()).filter(Boolean);
      const empPlanAreas = String(row['EMP Plan Area(s) (Values separated with ";")'] || '').split(';').map(a => a.trim()).filter(Boolean);
      const spObjectives = String(row['Strategic Plan Objective'] || '').split(';').map(o => o.trim()).filter(Boolean);

      // Extract chronological actuals
      const history = [];
      HISTORICAL_YEARS.forEach(year => {
        const val = row[year];
        if (val !== null && val !== undefined && val !== '') {
          const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]/g, ''));
          if (!isNaN(num)) {
            history.push({ year, value: num, raw: val });
          }
        }
      });

      // Latest actual & Prior actual
      const latestPoint = history.length > 0 ? history[history.length - 1] : null;
      const priorPoint = history.length > 1 ? history[history.length - 2] : null;

      const latestActual = latestPoint ? latestPoint.value : null;
      const latestYear = latestPoint ? latestPoint.year : 'N/A';
      const priorActual = priorPoint ? priorPoint.value : null;

      // Year-over-Year Delta
      let yoyDelta = null;
      let yoyPct = null;
      if (latestActual !== null && priorActual !== null) {
        yoyDelta = latestActual - priorActual;
        yoyPct = priorActual !== 0 ? (yoyDelta / Math.abs(priorActual)) * 100 : 0;
      }

      // Detect if lower value is desirable (e.g. Average Units Accumulated M-031, M-032, M-033)
      const isInverseMetric = name.toLowerCase().includes('units accumulated') ||
                             name.toLowerCase().includes('excess units') ||
                             name.toLowerCase().includes('time to degree');

      return {
        id,
        name,
        plans,
        categories,
        parentGroup,
        subgroup,
        unitFormat,
        definition,
        dataSource,
        responsible,
        pillar,
        notes,
        empGoals,
        spGoals,
        empPlanAreas,
        spObjectives,
        empBaselineRaw,
        empTargetRaw,
        spBaselineRaw,
        spTargetRaw,
        datePulled,
        accjc,
        strongWorkforce,
        scff,
        sea,
        vision2030,
        history,
        latestActual,
        latestYear,
        priorActual,
        yoyDelta,
        yoyPct,
        isInverseMetric,
        raw: row
      };
    });

    // Update File Info Badge
    if (elements.currentFileBadge) {
      elements.currentFileBadge.innerHTML = `
        <i class="fa-solid fa-check-circle text-green"></i>
        <span>Dataset Active: <strong>${escapeHtml(sourceName)}</strong> (Master Sheet &bull; ${state.normalizedMetrics.length} Metrics)</span>
      `;
    }

    // Refresh UI Plan Counts
    updatePlanCounts();

    // Populate Filter Dropdowns dynamically
    populateFilterDropdowns();

    // Render Dashboard View
    renderDashboard();
  }

  // Target Horizon Constant: By 2030 (Academic year 2029-2030, ending ~May 31, 2030)
  const TARGET_HORIZON_YEAR = 2030;

  function parseYearEnd(yrStr) {
    if (!yrStr) return 2026;
    const parts = String(yrStr).trim().split('-');
    if (parts.length === 2) {
      const end = parseInt(parts[1], 10);
      return isNaN(end) ? 2026 : end;
    }
    const yr = parseInt(yrStr, 10);
    return isNaN(yr) ? 2026 : yr;
  }

  function formatShortYear(yrStr) {
    if (!yrStr) return '';
    const parts = String(yrStr).trim().split('-');
    if (parts.length === 2) {
      return `'${parts[0].slice(-2)}-'${parts[1].slice(-2)}`;
    }
    return String(yrStr);
  }

  /**
   * Adaptive Momentum Regression Engine:
   * Combines recent institutional momentum (last 3 chronological data points)
   * with recency-weighted exponential regression across the multi-year history.
   * This ensures extreme pandemic disruptions (2020-2022) do not drag down
   * valid post-pandemic recoveries (e.g. In-Person Course Success, Fontana FTES, Chino FTES).
   */
  function calculateAdaptiveRegressionSlope(points) {
    if (!points || points.length < 2) return 0;
    if (points.length === 2) {
      const dx = points[1].x - points[0].x;
      return dx !== 0 ? (points[1].y - points[0].y) / dx : 0;
    }

    const n = points.length;

    // 1. Recent Momentum Window (last 3 chronological points representing active operational trajectory)
    const recentPoints = points.slice(-3);
    const nRec = recentPoints.length;
    let sumXr = 0, sumYr = 0, sumXXr = 0, sumXYr = 0;
    for (let i = 0; i < nRec; i++) {
      const x = recentPoints[i].x;
      const y = recentPoints[i].y;
      sumXr += x;
      sumYr += y;
      sumXXr += x * x;
      sumXYr += x * y;
    }
    const denomRec = nRec * sumXXr - sumXr * sumXr;
    const mRecent = denomRec !== 0 ? (nRec * sumXYr - sumXr * sumYr) / denomRec : 0;

    // 2. Recency-Weighted Least Squares across full series (decay alpha = 1.6)
    let sumW = 0, sumWx = 0, sumWy = 0, sumWxx = 0, sumWxy = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.pow(1.6, i);
      const x = points[i].x;
      const y = points[i].y;
      sumW += w;
      sumWx += w * x;
      sumWy += w * y;
      sumWxx += w * x * x;
      sumWxy += w * x * y;
    }
    const denomW = sumW * sumWxx - sumWx * sumWx;
    const mWls = denomW !== 0 ? (sumW * sumWxy - sumWx * sumWy) / denomW : 0;

    // 3. Adaptive Blending
    // If recent momentum shows sustained recovery or improvement, prioritize active trajectory (80% weight)
    const isRecentRecovery = recentPoints[recentPoints.length - 1].y > recentPoints[0].y;
    const recentWeight = isRecentRecovery ? 0.80 : 0.65;

    return (recentWeight * mRecent) + ((1.0 - recentWeight) * mWls);
  }

  /**
   * Generates continuous interim annual forecast projections from latest actual up to 2030 deadline.
   */
  function generateInterimProjections(latestYearEnd, latestActual, annualSlope, targetHorizonYear) {
    const horizon = targetHorizonYear || 2030;
    const interim = [];
    if (!latestYearEnd || latestActual === null || isNaN(latestActual) || latestYearEnd >= horizon) {
      return interim;
    }

    for (let yr = latestYearEnd + 1; yr <= horizon; yr++) {
      const startYr = yr - 1;
      const fullLabel = `${startYr}-${yr}`;
      const shortLabel = `'${String(startYr).slice(-2)}-'${String(yr).slice(-2)}*`;
      const elapsedYears = yr - latestYearEnd;
      const projVal = latestActual + (annualSlope * elapsedYears);
      interim.push({
        yearEnd: yr,
        fullLabel,
        shortLabel,
        elapsedYears,
        value: projVal,
        isTargetDeadline: yr === horizon
      });
    }
    return interim;
  }

  function formatRate(val, unitFormat) {
    if (val === null || val === undefined || isNaN(val)) return '0';
    const isPercent = (unitFormat || '').toLowerCase().includes('percent');
    if (isPercent) {
      const pct = Math.abs(val) <= 1.0 ? val * 100 : val;
      return `${pct >= 0 ? '+' : ''}${Math.round(pct * 10) / 10}%`;
    }
    const rounded = Math.round(val * 10) / 10;
    return `${rounded >= 0 ? '+' : ''}${Number(rounded).toLocaleString()}`;
  }

  /**
   * Evaluates plan-specific metrics for the active tab (EMP, Strategic Plan, Report Card, or All).
   * Calculates plan-specific target, baseline, numerical gap, and "On Track" / "Off Track" trend.
   *
   * Addresses:
   * - Requirement 1: Dual-unit handling (M-024, M-025, M-035, M-036) where counts vs percentages are on different scales.
   * - Requirement 2: Metrics without targets are strictly marked as 'Tracking' (NEVER 'On Track' or 'Needs Attention').
   * - 2030 Predictive Goal Trajectory & Status Engine: Calculates historical annual rate of change,
   *   projects whether metric will hit the 2029-2030 deadline, and computes required annual pace.
   */
  function evaluateMetricForActivePlan(metric, planName) {
    const isEmp = planName === 'Educational Master Plan';
    const isSp = planName === 'Strategic Plan (2026-2030)';
    const isDualUnit = DUAL_UNIT_METRIC_IDS.includes(metric.id);

    let rawTarget = null;
    let rawBaseline = null;
    let targetLabel = 'Target Goal (By 2030)';
    let baselineLabel = 'Baseline';
    let activeUnitFormat = metric.unitFormat;
    let effectiveLatestActual = metric.latestActual;
    let companionHeadcount = null;
    let defaultBaselineYearEnd = 2026;

    if (isEmp) {
      rawTarget = metric.empTargetRaw;
      rawBaseline = metric.empBaselineRaw;
      targetLabel = 'EMP Target (By 2030)';
      baselineLabel = '2025-2026 (Yr 0)';
      defaultBaselineYearEnd = 2026;

      if (isDualUnit) {
        activeUnitFormat = 'Count (Headcount)';
        rawTarget = null; // EMP tracks headcount without separate percentage target
      }
    } else if (isSp) {
      rawTarget = metric.spTargetRaw;
      rawBaseline = metric.spBaselineRaw;
      targetLabel = 'SP Target (By 2030)';
      baselineLabel = '2024-2025 (Yr 0)';
      defaultBaselineYearEnd = 2025;

      if (isDualUnit) {
        // Requirement 1 Fix: In Strategic Plan, the metric is a percentage proportion (DataVista)
        activeUnitFormat = 'Percentage';
        effectiveLatestActual = parseNumericValue(metric.spBaselineRaw);
        companionHeadcount = metric.latestActual; // companion student count from Report Card
      }
    } else if (planName === 'Ongoing Report Card') {
      rawTarget = isDualUnit ? null : metric.empTargetRaw;
      rawBaseline = metric.history.length > 0 ? metric.history[0].value : null;
      targetLabel = 'Report Card Target';
      baselineLabel = '2020-2021 Baseline';
      defaultBaselineYearEnd = 2021;

      if (isDualUnit) {
        activeUnitFormat = 'Count (Headcount)';
        rawTarget = null;
      }
    } else if (planName === 'BOTH') {
      // BOTH (EMP & Strategic Plan Overlap View)
      if (isDualUnit) {
        activeUnitFormat = 'Percentage';
        effectiveLatestActual = parseNumericValue(metric.spBaselineRaw);
        companionHeadcount = metric.latestActual;
        rawTarget = metric.spTargetRaw;
        rawBaseline = metric.spBaselineRaw;
      } else {
        rawTarget = metric.spTargetRaw || metric.empTargetRaw;
        rawBaseline = metric.spBaselineRaw || metric.empBaselineRaw || (metric.history.length > 0 ? metric.history[0].value : null);
      }
      targetLabel = 'Shared Target (By 2030)';
      baselineLabel = 'Baseline Year';
      defaultBaselineYearEnd = metric.spBaselineRaw ? 2025 : (metric.empBaselineRaw ? 2026 : 2025);
    } else {
      // ALL (Master Unified View)
      if (isDualUnit) {
        activeUnitFormat = 'Count (Headcount)';
        rawTarget = null;
        companionHeadcount = metric.latestActual;
      } else {
        rawTarget = metric.empTargetRaw || metric.spTargetRaw;
        rawBaseline = metric.empBaselineRaw || metric.spBaselineRaw || (metric.history.length > 0 ? metric.history[0].value : null);
      }
      targetLabel = 'Target Horizon (By 2030)';
      baselineLabel = 'Baseline Year';
      defaultBaselineYearEnd = metric.empBaselineRaw ? 2026 : 2025;
    }

    // Parse numeric baseline
    let baseline = null;
    if (rawBaseline !== null && rawBaseline !== undefined && rawBaseline !== '') {
      baseline = parseNumericValue(rawBaseline);
    } else if (metric.history.length > 0) {
      baseline = metric.history[0].value;
    }

    // Years from baseline to 2030 target deadline (2029-2030 academic year)
    const yearsFromBaseline = Math.max(1, TARGET_HORIZON_YEAR - defaultBaselineYearEnd);

    // Parse numeric target
    let target = null;
    let targetDisplay = 'No Target Set';
    if (rawTarget !== null && rawTarget !== undefined && rawTarget !== '') {
      targetDisplay = String(rawTarget).trim();
      target = parseTargetValue(rawTarget, baseline, yearsFromBaseline);
    }

    // Scale synchronization guard (Fix for M-041 and percentage metrics):
    // If target is a decimal proportion (<= 1.0) and baseline is on 0-100 scale (or vice versa), synchronize scales
    if (baseline !== null && target !== null) {
      if (target <= 1.0 && baseline > 1.0 && activeUnitFormat.toLowerCase().includes('percent')) {
        baseline = baseline / 100;
      } else if (target > 1.0 && baseline <= 1.0 && activeUnitFormat.toLowerCase().includes('percent')) {
        target = target / 100;
      }
    }

    const latestActual = effectiveLatestActual;
    const isInverse = metric.isInverseMetric;

    // Remaining years from latest actual data year to 2030 target deadline
    const latestYearEnd = metric.latestYear ? parseYearEnd(metric.latestYear) : 2026;
    const yearsRemaining = Math.max(0, TARGET_HORIZON_YEAR - latestYearEnd);

    // Calculate historical annual rate of change (linear slope)
    const validHistoryPoints = metric.history
      .map(h => ({ x: parseYearEnd(h.year), y: h.value }))
      .filter(p => p.y !== null && !isNaN(p.y));

    // Handle percentage scaling in history if metric unit is percentage and values > 1.0
    if (activeUnitFormat.toLowerCase().includes('percent') && target !== null && target <= 1.0) {
      validHistoryPoints.forEach(p => {
        if (p.y > 1.0) p.y = p.y / 100;
      });
    }

    // Calculate historical annual rate of change using Adaptive Momentum Regression
    const annualSlope = validHistoryPoints.length >= 2 ? calculateAdaptiveRegressionSlope(validHistoryPoints) : 0;
    const annualRatePct = (latestActual !== null && latestActual !== 0) ? (annualSlope / Math.abs(latestActual)) * 100 : 0;

    // Generate continuous multi-year interim forecast pathway up to 2030
    const interimProjections = (target !== null && !isNaN(target) && latestActual !== null)
      ? generateInterimProjections(latestYearEnd, latestActual, annualSlope, TARGET_HORIZON_YEAR)
      : [];

    // Predictive Projections to By 2030 Deadline
    let projected2030 = interimProjections.length > 0
      ? interimProjections[interimProjections.length - 1].value
      : (target !== null && latestActual !== null ? latestActual + (annualSlope * yearsRemaining) : null);
    let requiredAnnualChange = null;
    let requiredAnnualPct = null;
    let gap = null;
    let progressPct = null;
    let status = 'Tracking';
    let predictiveStatus = 'Tracking';
    let verdict = 'Annual baseline monitoring; no 2030 target horizon assigned.';
    let isAtRisk = false;

    // Requirement 2 Enforcement:
    // If NO target horizon is set, the metric MUST strictly show as 'Tracking' (NEVER 'On Track', NEVER 'Needs Attention')
    if (target === null || target === undefined || isNaN(target)) {
      status = 'Tracking';
      predictiveStatus = 'Tracking Only';
      isAtRisk = false;
      gap = null;
      progressPct = null;
      targetDisplay = 'No Target Set';
      verdict = 'Annual baseline monitoring; no 2030 target horizon assigned.';
    } else if (latestActual !== null) {
      requiredAnnualChange = yearsRemaining > 0 ? (target - latestActual) / yearsRemaining : 0;
      requiredAnnualPct = latestActual !== 0 ? (requiredAnnualChange / Math.abs(latestActual)) * 100 : 0;

      if (isInverse) {
        // Lower is better (Units accumulated: target 76, baseline 81)
        gap = latestActual - target;
        const targetMet = latestActual <= target;

        if (targetMet) {
          status = 'Goal Met';
          predictiveStatus = '2030 Target Achieved';
          progressPct = 100;
          isAtRisk = false;
          verdict = `2030 Target already achieved (${formatMetricValue(latestActual, activeUnitFormat)} vs target ${formatMetricValue(target, activeUnitFormat)}). Maintaining momentum.`;
        } else {
          if (baseline !== null && baseline !== target) {
            progressPct = ((baseline - latestActual) / (baseline - target)) * 100;
            progressPct = Math.max(0, Math.min(progressPct, 150));
          } else {
            progressPct = Math.max(0, 100 - (gap / target) * 100);
          }

          const willHit2030 = projected2030 <= target;
          const isImproving = annualSlope < 0;

          if (willHit2030) {
            status = 'On Track';
            predictiveStatus = 'Projected to Hit 2030 Target';
            isAtRisk = false;
            verdict = `At current reduction pace (${formatRate(annualSlope, activeUnitFormat)}/yr), projected to reach ${formatMetricValue(projected2030, activeUnitFormat)} by May 31, 2030, meeting target of ${formatMetricValue(target, activeUnitFormat)}.`;
          } else if (isImproving) {
            status = 'Off Track';
            predictiveStatus = 'Behind Pace for 2030';
            isAtRisk = true;
            verdict = `Reducing units (${formatRate(annualSlope, activeUnitFormat)}/yr), but requires accelerated reduction of ${formatRate(requiredAnnualChange, activeUnitFormat)}/yr to reach ${formatMetricValue(target, activeUnitFormat)} by 2030. Projected 2030: ${formatMetricValue(projected2030, activeUnitFormat)}.`;
          } else {
            status = 'Off Track';
            predictiveStatus = 'Needs Attention (Increasing)';
            isAtRisk = true;
            verdict = `Average units accumulated are increasing (+${formatRate(annualSlope, activeUnitFormat)}/yr) away from target (${formatMetricValue(target, activeUnitFormat)}).`;
          }
        }
      } else {
        // Standard metric: Higher is better
        gap = target - latestActual;
        const targetMet = latestActual >= target;

        if (targetMet) {
          status = 'Goal Met';
          predictiveStatus = '2030 Target Achieved';
          progressPct = 100;
          isAtRisk = false;
          verdict = `2030 Target already achieved (${formatMetricValue(latestActual, activeUnitFormat)} vs target ${formatMetricValue(target, activeUnitFormat)}). Maintaining trajectory.`;
        } else {
          if (baseline !== null && target !== baseline) {
            progressPct = ((latestActual - baseline) / (target - baseline)) * 100;
            progressPct = Math.max(0, Math.min(progressPct, 150));
          } else {
            progressPct = target > 0 ? (latestActual / target) * 100 : 0;
            progressPct = Math.max(0, Math.min(progressPct, 150));
          }

          const willHit2030 = projected2030 >= target;
          const isImproving = annualSlope > 0;

          if (willHit2030) {
            status = 'On Track';
            predictiveStatus = 'Projected to Hit 2030 Target';
            isAtRisk = false;
            verdict = `At current annual pace (${formatRate(annualSlope, activeUnitFormat)}/yr), projected to reach ${formatMetricValue(projected2030, activeUnitFormat)} by May 31, 2030, exceeding target of ${formatMetricValue(target, activeUnitFormat)}.`;
          } else if (isImproving) {
            status = 'Off Track';
            predictiveStatus = 'Behind Pace for 2030';
            isAtRisk = true;
            verdict = `Currently improving (+${formatRate(annualSlope, activeUnitFormat)}/yr), but behind required pace of ${formatRate(requiredAnnualChange, activeUnitFormat)}/yr. Projected to reach ${formatMetricValue(projected2030, activeUnitFormat)} by 2030 (target: ${formatMetricValue(target, activeUnitFormat)}).`;
          } else {
            status = 'Off Track';
            predictiveStatus = 'Needs Attention (Declining)';
            isAtRisk = true;
            verdict = `Trending downward (${formatRate(annualSlope, activeUnitFormat)}/yr) away from target. Requires annual turnaround of ${formatRate(requiredAnnualChange, activeUnitFormat)}/yr to reach ${formatMetricValue(target, activeUnitFormat)} by 2030.`;
          }
        }
      }
    }

    return {
      ...metric,
      unitFormat: activeUnitFormat,
      latestActual,
      companionHeadcount,
      baseline,
      rawBaseline,
      target,
      rawTarget,
      targetDisplay,
      targetLabel,
      baselineLabel,
      yearsRemaining,
      annualSlope,
      annualRatePct,
      projected2030,
      interimProjections,
      requiredAnnualChange,
      requiredAnnualPct,
      gap,
      progressPct: progressPct !== null ? Math.round(progressPct * 10) / 10 : null,
      status,
      predictiveStatus,
      verdict,
      isAtRisk
    };
  }

  /**
   * Parses targets that can be decimals, percentages, integers, or growth text (e.g. "1% per year").
   * Supports By 2030 horizon compounding.
   */
  function parseTargetValue(rawTarget, baseline, yearsFromBaseline) {
    if (rawTarget === null || rawTarget === undefined) return null;

    if (typeof rawTarget === 'number') return rawTarget;

    const str = String(rawTarget).trim().toLowerCase();

    // Check for "1% per year" or "increase 1% per year"
    if (str.includes('% per year') || str.includes('per year')) {
      const match = str.match(/(\d+(\.\d+)?)%/);
      const rate = match ? parseFloat(match[1]) / 100 : 0.01;
      if (baseline !== null && baseline > 0) {
        const horizon = yearsFromBaseline || 4;
        return Math.round(baseline * Math.pow(1 + rate, horizon) * 100) / 100;
      }
      return null;
    }

    // Direct percentage string: "75%", "80%"
    if (str.endsWith('%')) {
      const num = parseFloat(str.replace('%', ''));
      return isNaN(num) ? null : num / 100;
    }

    // Direct numeric string
    const cleaned = str.replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  function parseNumericValue(val) {
    if (typeof val === 'number') return val;
    if (!val) return null;

    const str = String(val).trim();
    // Match the FIRST valid number in the string (e.g. "71.3" from "71.3% (Students of Color) / 69.9% (All Students)")
    const match = str.match(/[-+]?[0-9]*\.?[0-9]+/);
    if (!match) return null;

    let num = parseFloat(match[0]);
    if (isNaN(num)) return null;

    // If formatted as a percentage like "71.3%", convert to decimal proportion (0.713)
    if (str.includes('%') && num > 1.0) {
      num = num / 100;
    }

    return num;
  }

  // ============================================================================
  // 3. Filtering System & Cascading Logic
  // ============================================================================

  /**
   * Helper to test whether a metric matches a selected modality / subgroup filter.
   */
  function matchesModality(m, modVal) {
    if (!modVal) return true;
    const sub = (m.subgroup || '').toLowerCase();
    const cat = (m.categories || []).join(' ').toLowerCase();
    const area = (m.empPlanAreas || []).join(' ').toLowerCase();
    const name = (m.name || '').toLowerCase();
    const traits = String(m.raw?.['Metric Trait(s) / Initiative Alignment (Values separated with ";")'] || '').toLowerCase();

    switch (modVal) {
      case 'Online':
        return sub.includes('online') || cat.includes('online') || area.includes('online') || name.includes('online');
      case 'In-Person':
        return sub.includes('in-person') || name.includes('in-person');
      case 'Hybrid':
        return sub.includes('hybrid') || name.includes('hybrid');
      case 'Total Districtwide':
        return sub.includes('total') || sub.includes('districtwide');
      case 'Locations':
        // Specifically campus locations (Chino, Fontana, Rancho), strictly excluding districtwide totals
        if (sub.includes('districtwide') || sub.includes('total')) return false;
        return sub.includes('chino') || sub.includes('fontana') || sub.includes('rancho') ||
               name.includes('chino') || name.includes('fontana') || name.includes('rancho') ||
               (sub.includes('location:') && !sub.includes('districtwide'));
      case 'SCFF':
        return traits.includes('scff') || sub.includes('scff');
      case 'Demographics: Ethnicity':
        return cat.includes('ethnicity') || sub.includes('ethnicity');
      case 'Demographics: Gender':
        return cat.includes('gender') || sub.includes('gender');
      case 'Demographics: Age':
        return cat.includes('age') || sub.includes('age');
      case 'Special Populations':
        return cat.includes('special populations') || sub.includes('population') || sub.includes('pell') || sub.includes('ccpg') || sub.includes('ab540');
      case 'Transfer Destinations':
        return cat.includes('transfer (by segment)') || sub.includes('destination');
      case 'Term Status':
        return cat.includes('term status') || sub.includes('terms:');
      case 'Degrees & Certificates':
        return sub.includes('degree') || sub.includes('certificate') || sub.includes('adt') || sub.includes('awards');
      case 'Math & English':
        return sub.includes('math') || sub.includes('english') || name.includes('math') || name.includes('english');
      case 'Employees':
        return sub.includes('employee') || name.includes('employee') || name.includes('faculty');
      case 'Learning Outcomes':
        return sub.includes('ilo') || name.includes('learning outcome') || name.includes('ilo');
      case 'CPL':
        return sub.includes('cpl') || name.includes('prior learning');
      case 'Skill Tokens':
        return sub.includes('token') || name.includes('skill token');
      default:
        return sub.includes(modVal.toLowerCase()) || name.toLowerCase().includes(modVal.toLowerCase());
    }
  }

  /**
   * Dynamically populates Category, Guided Pathways Pillar, Plan Goal, Plan Area/Objective,
   * and Modality/Sub-Group dropdowns so ONLY relevant options present in the active plan appear.
   * Fulfills:
   * - Requirement 1: Separate filters for Goals and Areas
   * - Requirement 6: Strategic Pillar then Plan Goal then Plan Area
   * - Requirement 8: Only relevant options for active plan (no 0-result options)
   */
  function populateFilterDropdowns() {
    // Determine metrics matching the active Plan
    const planMetrics = state.normalizedMetrics.filter(m => {
      if (!CONFIG.showOngoingReportCard && !CONFIG.includeReportCardOnlyMetricsWhenHidden) {
        const hasVisiblePlan = m.plans.some(p => !p.toLowerCase().includes('report card'));
        if (!hasVisiblePlan) return false;
      }
      if (state.activePlan === 'ALL') return true;
      if (state.activePlan === 'BOTH') {
        const hasEmp = m.plans.some(p => p.includes('Educational Master Plan'));
        const hasSp = m.plans.some(p => p.includes('Strategic Plan'));
        return hasEmp && hasSp;
      }
      if (state.activePlan === 'Educational Master Plan') {
        return m.plans.includes('Educational Master Plan');
      }
      if (state.activePlan === 'Strategic Plan (2026-2030)') {
        return m.plans.some(p => p.includes('Strategic Plan'));
      }
      if (state.activePlan === 'Ongoing Report Card') {
        return m.plans.includes('Ongoing Report Card');
      }
      return true;
    });

    // 1. Metric Categories (only those present in current plan)
    const categorySet = new Set();
    planMetrics.forEach(m => {
      m.categories.forEach(c => categorySet.add(c));
    });
    const currentCat = state.activeFilters.category;
    elements.categoryFilter.innerHTML = '<option value="">All Categories</option>';
    Array.from(categorySet).sort().forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      elements.categoryFilter.appendChild(opt);
    });
    if (categorySet.has(currentCat)) {
      elements.categoryFilter.value = currentCat;
    } else {
      state.activeFilters.category = '';
    }

    // 2. Guided Pathways Pillars (only those present in current plan, split by ';')
    const pillarSet = new Set();
    planMetrics.forEach(m => {
      if (m.pillar) {
        m.pillar.split(';').map(p => p.trim()).filter(Boolean).forEach(p => pillarSet.add(p));
      }
    });
    const currentPillar = state.activeFilters.pillar;
    elements.pillarFilter.innerHTML = '<option value="">All Strategic Pillars</option>';
    Array.from(pillarSet).sort().forEach(pillar => {
      const opt = document.createElement('option');
      opt.value = pillar;
      opt.textContent = pillar;
      elements.pillarFilter.appendChild(opt);
    });
    if (pillarSet.has(currentPillar)) {
      elements.pillarFilter.value = currentPillar;
    } else {
      state.activeFilters.pillar = '';
    }

    // 3. Plan Goals (only goals present in current plan, split by ';', with [EMP] and [SP] indicators)
    const empGoalSet = new Set();
    const spGoalSet = new Set();

    planMetrics.forEach(m => {
      if (state.activePlan === 'Educational Master Plan') {
        m.empGoals.forEach(g => empGoalSet.add(g));
      } else if (state.activePlan === 'Strategic Plan (2026-2030)') {
        m.spGoals.forEach(g => spGoalSet.add(g));
      } else if (state.activePlan === 'Ongoing Report Card') {
        m.empGoals.forEach(g => empGoalSet.add(g));
      } else {
        m.empGoals.forEach(g => empGoalSet.add(g));
        m.spGoals.forEach(g => spGoalSet.add(g));
      }
    });

    const currentGoal = state.activeFilters.goal;
    elements.goalFilter.innerHTML = '<option value="">All Plan Goals</option>';

    const goalOptions = [];
    Array.from(empGoalSet).sort().forEach(g => {
      goalOptions.push({
        value: g,
        label: `[EMP] ${g}`
      });
    });

    Array.from(spGoalSet).sort().forEach(g => {
      const displayLabel = g.startsWith('Goal') ? g : `Goal ${g}`;
      goalOptions.push({
        value: g,
        label: `[SP] ${displayLabel}`
      });
    });

    goalOptions.sort((a, b) => a.label.localeCompare(b.label)).forEach(optData => {
      const opt = document.createElement('option');
      opt.value = optData.value;
      opt.textContent = optData.label;
      elements.goalFilter.appendChild(opt);
    });

    if (empGoalSet.has(currentGoal) || spGoalSet.has(currentGoal)) {
      elements.goalFilter.value = currentGoal;
    } else {
      state.activeFilters.goal = '';
    }

    // 4. Plan Areas / Objectives (only areas/objectives present in current plan, split by ';')
    const empAreaSet = new Set();
    const spObjectiveSet = new Set();

    planMetrics.forEach(m => {
      if (state.activePlan === 'Educational Master Plan') {
        m.empPlanAreas.forEach(a => empAreaSet.add(a));
      } else if (state.activePlan === 'Strategic Plan (2026-2030)') {
        m.spObjectives.forEach(o => spObjectiveSet.add(o));
      } else if (state.activePlan === 'Ongoing Report Card') {
        m.empPlanAreas.forEach(a => empAreaSet.add(a));
      } else {
        m.empPlanAreas.forEach(a => empAreaSet.add(a));
        m.spObjectives.forEach(o => spObjectiveSet.add(o));
      }
    });

    if (elements.areaFilter) {
      const currentArea = state.activeFilters.area;
      elements.areaFilter.innerHTML = '<option value="">All Plan Areas & Objectives</option>';

      const areaOptions = [];
      Array.from(empAreaSet).sort().forEach(a => {
        areaOptions.push({
          value: a,
          label: (state.activePlan === 'ALL' || state.activePlan === 'BOTH') ? `[EMP] ${a}` : a
        });
      });
      Array.from(spObjectiveSet).sort().forEach(o => {
        areaOptions.push({
          value: o,
          label: (state.activePlan === 'ALL' || state.activePlan === 'BOTH') ? `[SP] ${o}` : o
        });
      });

      areaOptions.sort((a, b) => a.label.localeCompare(b.label)).forEach(optData => {
        const opt = document.createElement('option');
        opt.value = optData.value;
        opt.textContent = optData.label;
        elements.areaFilter.appendChild(opt);
      });

      if (empAreaSet.has(currentArea) || spObjectiveSet.has(currentArea)) {
        elements.areaFilter.value = currentArea;
      } else {
        state.activeFilters.area = '';
      }
    }

    // 5. Modality / Subgroup Filter (Only options that have >= 1 matching metric in the active plan)
    const CANDIDATE_MODALITIES = [
      { key: 'Online', label: 'Modality: Online' },
      { key: 'In-Person', label: 'Modality: In-Person' },
      { key: 'Hybrid', label: 'Modality: Hybrid' },
      { key: 'Total Districtwide', label: 'Total Districtwide' },
      { key: 'Locations', label: 'Campus Locations (Chino / Fontana)' },
      { key: 'SCFF', label: 'SCFF / Funding Formula Aligned' },
      { key: 'Math & English', label: 'Transfer-Level Math & English' },
      { key: 'Degrees & Certificates', label: 'Degree & Certificate Attainment' },
      { key: 'Employees', label: 'All Employees & Faculty' },
      { key: 'Learning Outcomes', label: 'Learning Outcomes (ILOs)' },
      { key: 'CPL', label: 'Credit for Prior Learning (CPL)' },
      { key: 'Skill Tokens', label: 'Skill Tokens' },
      { key: 'Demographics: Ethnicity', label: 'Demographics: Ethnicity' },
      { key: 'Demographics: Gender', label: 'Demographics: Gender' },
      { key: 'Demographics: Age', label: 'Demographics: Age Groups' },
      { key: 'Special Populations', label: 'Special Populations (EOPS, DSPS, Veterans, Foster)' },
      { key: 'Transfer Destinations', label: 'Transfer Destinations (CSU, UC, Out-of-State)' },
      { key: 'Term Status', label: 'Term Enrollment Status (Full/Part Time)' }
    ];

    const currentMod = state.activeFilters.modality;
    elements.modalityFilter.innerHTML = '<option value="">All Modalities & Groups</option>';
    let modStillValid = false;

    CANDIDATE_MODALITIES.forEach(({ key, label }) => {
      // Test if any metric in planMetrics matches this modality
      const matchCount = planMetrics.filter(m => matchesModality(m, key)).length;
      if (matchCount > 0) {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = `${label} (${matchCount})`;
        elements.modalityFilter.appendChild(opt);
        if (key === currentMod) modStillValid = true;
      }
    });

    if (modStillValid) {
      elements.modalityFilter.value = currentMod;
    } else {
      state.activeFilters.modality = '';
    }

    // 6. Institutional Initiatives Filter (Only options that have >= 1 matching metric in the active plan)
    if (elements.initiativeFilter) {
      const INITIATIVES = [
        { key: 'vision2030', label: 'Vision 2030', count: planMetrics.filter(m => m.vision2030).length },
        { key: 'scff', label: 'SCFF (Funding Formula)', count: planMetrics.filter(m => m.scff).length },
        { key: 'strongWorkforce', label: 'Strong Workforce', count: planMetrics.filter(m => m.strongWorkforce).length },
        { key: 'sea', label: 'Student Equity & Achievement', count: planMetrics.filter(m => m.sea).length },
        { key: 'accjc', label: 'ACCJC Standards', count: planMetrics.filter(m => m.accjc).length }
      ];

      const currentInit = state.activeFilters.initiative;
      elements.initiativeFilter.innerHTML = '<option value="">All Initiatives</option>';
      let initStillValid = false;

      INITIATIVES.forEach(({ key, label, count }) => {
        if (count > 0) {
          const opt = document.createElement('option');
          opt.value = key;
          opt.textContent = `${label} (${count})`;
          elements.initiativeFilter.appendChild(opt);
          if (key === currentInit) initStillValid = true;
        }
      });

      if (initStillValid) {
        elements.initiativeFilter.value = currentInit;
      } else {
        state.activeFilters.initiative = '';
      }
    }
  }

  /**
   * Filters the metrics list against all active criteria.
   * - Requirement 3: When Highlight At-Risk is active, filters to show ONLY at-risk metrics.
   * - Requirement 1 & 5: Matches against separated individual goals and plan areas.
   * - Requirement 8: Evaluates modalities and subgroups dynamically.
   */
  function getFilteredMetrics() {
    const plan = state.activePlan;
    const f = state.activeFilters;

    // Step 1: Filter by Plan
    let list = state.normalizedMetrics.filter(m => {
      if (!CONFIG.showOngoingReportCard && !CONFIG.includeReportCardOnlyMetricsWhenHidden) {
        const hasVisiblePlan = m.plans.some(p => !p.toLowerCase().includes('report card'));
        if (!hasVisiblePlan) return false;
      }

      if (plan === 'ALL') return true;
      if (plan === 'BOTH') {
        const hasEmp = m.plans.some(p => p.includes('Educational Master Plan'));
        const hasSp = m.plans.some(p => p.includes('Strategic Plan'));
        return hasEmp && hasSp;
      }
      if (plan === 'Educational Master Plan') {
        return m.plans.includes('Educational Master Plan');
      }
      if (plan === 'Strategic Plan (2026-2030)') {
        return m.plans.some(p => p.includes('Strategic Plan'));
      }
      if (plan === 'Ongoing Report Card') {
        return m.plans.includes('Ongoing Report Card');
      }
      return true;
    });

    // Step 2: Evaluate plan-specific fields (target, baseline, status, at-risk)
    let evaluatedList = list.map(m => evaluateMetricForActivePlan(m, plan));

    // Step 3: Apply Filters
    return evaluatedList.filter(m => {
      // Requirement 3: When Highlight At-Risk is toggled ON, ONLY show at-risk metrics
      if (state.highlightAtRisk) {
        if (!m.isAtRisk && m.status !== 'Off Track') return false;
      }

      // Search input (ID, name, definition, pillar, category)
      if (f.search) {
        const query = f.search.toLowerCase();
        const match = m.id.toLowerCase().includes(query) ||
                      m.name.toLowerCase().includes(query) ||
                      m.definition.toLowerCase().includes(query) ||
                      m.pillar.toLowerCase().includes(query) ||
                      m.subgroup.toLowerCase().includes(query);
        if (!match) return false;
      }

      // Category Filter
      if (f.category) {
        const catMatch = m.categories.some(c => c.toLowerCase() === f.category.toLowerCase());
        if (!catMatch) return false;
      }

      // Strategic Pillar Filter
      if (f.pillar) {
        if (!m.pillar.toLowerCase().includes(f.pillar.toLowerCase())) return false;
      }

      // Requirement 1 & 5: Goal Filter (Matches against individual semicolon-split goals)
      if (f.goal) {
        const targetGoal = f.goal.toLowerCase();
        const goalMatch = m.empGoals.some(g => g.toLowerCase() === targetGoal) ||
                          m.spGoals.some(g => g.toLowerCase() === targetGoal);
        if (!goalMatch) return false;
      }

      // Requirement 1: Separate Plan Area / Objective Filter
      if (f.area) {
        const targetArea = f.area.toLowerCase();
        const areaMatch = m.empPlanAreas.some(a => a.toLowerCase() === targetArea) ||
                          m.spObjectives.some(o => o.toLowerCase() === targetArea);
        if (!areaMatch) return false;
      }

      // Modality / Sub-Group Filter (Dynamic matching)
      if (f.modality) {
        if (!matchesModality(m, f.modality)) return false;
      }

      // Institutional Initiative Filter
      if (f.initiative) {
        if (f.initiative === 'vision2030' && !m.vision2030) return false;
        if (f.initiative === 'scff' && !m.scff) return false;
        if (f.initiative === 'strongWorkforce' && !m.strongWorkforce) return false;
        if (f.initiative === 'sea' && !m.sea) return false;
        if (f.initiative === 'accjc' && !m.accjc) return false;
      }

      // Status Filter
      if (f.status) {
        if (m.status !== f.status) return false;
      }

      // Quick Chips Filter
      if (f.quickChip === 'course-success') {
        const match = m.categories.some(c => c.toLowerCase().includes('course success'));
        if (!match) return false;
      } else if (f.quickChip === 'online-modality') {
        if (!matchesModality(m, 'Online')) return false;
      } else if (f.quickChip === 'at-risk') {
        if (!m.isAtRisk && m.status !== 'Off Track') return false;
      } else if (f.quickChip === 'has-target') {
        if (m.target === null) return false;
      } else if (f.quickChip === 'enrollment') {
        const match = m.categories.some(c => c.toLowerCase().includes('enrollment') || c.toLowerCase().includes('scheduling'));
        if (!match) return false;
      }

      return true;
    });
  }

  // ============================================================================
  // 4. UI Rendering: KPI Summary & Metric Cards Grid
  // ============================================================================

  function renderDashboard() {
    updatePlanHorizonBanner();

    const filteredMetrics = getFilteredMetrics();

    // Recalculate and update top KPI Summary (Plan Health)
    updateKpiSummary(filteredMetrics);

    // Update results counter
    if (elements.displayedMetricsCount) {
      elements.displayedMetricsCount.textContent = filteredMetrics.length;
    }

    // Render Metric Cards
    renderMetricCards(filteredMetrics);

    // Update active filter counter
    updateActiveFilterBadge();
  }

  function updatePlanHorizonBanner() {
    const info = PLAN_DEFINITIONS[state.activePlan] || PLAN_DEFINITIONS['ALL'];
    if (elements.planTitleDisplay) elements.planTitleDisplay.textContent = info.title;
    if (elements.planDescDisplay) elements.planDescDisplay.textContent = info.desc;

    if (elements.horizonTags) {
      elements.horizonTags.innerHTML = info.tags.map(tag => `
        <span class="horizon-tag"><i class="fa-solid fa-tag"></i> ${escapeHtml(tag)}</span>
      `).join('');
    }
  }

  function updatePlanCounts() {
    let empCount = 0, spCount = 0, rcCount = 0, allCount = 0, bothCount = 0;

    state.normalizedMetrics.forEach(m => {
      const hasEmp = m.plans.some(p => p.includes('Educational Master Plan'));
      const hasSp = m.plans.some(p => p.includes('Strategic Plan'));
      const hasRc = m.plans.includes('Ongoing Report Card');

      if (hasEmp) empCount++;
      if (hasSp) spCount++;
      if (hasRc) rcCount++;
      if (hasEmp && hasSp) bothCount++;

      if (CONFIG.showOngoingReportCard || CONFIG.includeReportCardOnlyMetricsWhenHidden) {
        allCount++;
      } else if (hasEmp || hasSp) {
        allCount++;
      }
    });

    if (elements.empCountPill) elements.empCountPill.textContent = empCount;
    if (elements.spCountPill) elements.spCountPill.textContent = spCount;
    if (elements.rcCountPill) elements.rcCountPill.textContent = rcCount;
    if (elements.allCountPill) elements.allCountPill.textContent = allCount;
    if (elements.bothCountPill) elements.bothCountPill.textContent = bothCount;
  }

  /**
   * Dynamically calculates executive summary KPI metrics:
   * Plan Health (% On Track of target-bearing metrics), Total, At-Risk, Target Achieved, and Average Goal Progress.
   * Requirement 2 & 7: Highlights active KPI card filters and correctly computes health.
   */
  function updateKpiSummary(metrics) {
    const total = metrics.length;
    if (total === 0) {
      if (elements.kpiHealthPercent) elements.kpiHealthPercent.textContent = '0%';
      if (elements.kpiHealthCircle) elements.kpiHealthCircle.setAttribute('stroke-dasharray', '0, 100');
      if (elements.kpiTotalMetrics) elements.kpiTotalMetrics.textContent = '0';
      if (elements.kpiOnTrackCount) elements.kpiOnTrackCount.textContent = '0';
      if (elements.kpiAtRiskCount) elements.kpiAtRiskCount.textContent = '0';
      if (elements.kpiGoalsMetCount) elements.kpiGoalsMetCount.textContent = '0';
      if (elements.kpiAvgProgress) elements.kpiAvgProgress.textContent = '0%';
      if (elements.kpiAvgProgressBar) elements.kpiAvgProgressBar.style.width = '0%';
      return;
    }

    let onTrackCount = 0;
    let atRiskCount = 0;
    let goalsMetCount = 0;
    let trackingCount = 0;
    let progressSum = 0;
    let progressCount = 0;

    metrics.forEach(m => {
      if (m.status === 'Goal Met') {
        goalsMetCount++;
        onTrackCount++;
      } else if (m.status === 'On Track') {
        onTrackCount++;
      } else if (m.status === 'Off Track' || m.isAtRisk) {
        atRiskCount++;
      } else {
        trackingCount++; // Baseline tracking without numeric target
      }

      if (m.progressPct !== null) {
        progressSum += m.progressPct;
        progressCount++;
      }
    });

    // Requirement 2: Health percentage calculated only among metrics that actually have target goals
    const targetBearingTotal = onTrackCount + atRiskCount;
    const healthPct = targetBearingTotal > 0 ? Math.round((onTrackCount / targetBearingTotal) * 100) : 100;
    const avgProgress = progressCount > 0 ? Math.round((progressSum / progressCount) * 10) / 10 : healthPct;

    // Update Plan Health Circular Gauge
    if (elements.kpiHealthPercent) elements.kpiHealthPercent.textContent = `${healthPct}%`;
    if (elements.kpiHealthCircle) {
      elements.kpiHealthCircle.setAttribute('stroke-dasharray', `${healthPct}, 100`);
      if (healthPct >= 75) {
        elements.kpiHealthCircle.style.stroke = 'var(--status-green)';
      } else if (healthPct >= 55) {
        elements.kpiHealthCircle.style.stroke = 'var(--status-amber)';
      } else {
        elements.kpiHealthCircle.style.stroke = 'var(--status-red)';
      }
    }

    if (elements.kpiHealthHeadline) {
      elements.kpiHealthHeadline.textContent = targetBearingTotal === 0 ? 'Baseline Tracking' :
                                               healthPct >= 80 ? 'Strong Trajectory' :
                                               healthPct >= 65 ? 'Satisfactory Progress' : 'Requires Attention';
    }

    if (elements.kpiHealthDetail) {
      elements.kpiHealthDetail.textContent = targetBearingTotal > 0 ?
        `${onTrackCount} of ${targetBearingTotal} goal-bearing metrics on track` :
        `${trackingCount} metrics tracking baseline (no targets set)`;
    }

    if (elements.kpiTotalMetrics) elements.kpiTotalMetrics.textContent = total;
    if (elements.kpiOnTrackCount) elements.kpiOnTrackCount.textContent = onTrackCount;
    if (elements.kpiOnTrackPct) elements.kpiOnTrackPct.textContent = targetBearingTotal > 0 ? `${healthPct}% of target-bearing` : 'Baseline Monitoring';
    if (elements.kpiAtRiskCount) elements.kpiAtRiskCount.textContent = atRiskCount;
    if (elements.kpiAtRiskPct) elements.kpiAtRiskPct.textContent = atRiskCount > 0 ? `${atRiskCount} requiring review` : 'All on target';
    if (elements.kpiGoalsMetCount) elements.kpiGoalsMetCount.textContent = goalsMetCount;
    if (elements.kpiAvgProgress) elements.kpiAvgProgress.textContent = `${avgProgress}%`;
    if (elements.kpiAvgProgressBar) elements.kpiAvgProgressBar.style.width = `${Math.min(avgProgress, 100)}%`;

    // Requirement 7: Synchronize active KPI filter styling
    const activeStatus = state.activeFilters.status;
    if (elements.kpiOnTrackCard) {
      elements.kpiOnTrackCard.classList.toggle('active-kpi-filter', activeStatus === 'On Track');
    }
    if (elements.kpiAtRiskCard) {
      elements.kpiAtRiskCard.classList.toggle('active-kpi-filter', activeStatus === 'Off Track' || state.highlightAtRisk);
    }
    if (elements.kpiGoalsMetCard) {
      elements.kpiGoalsMetCard.classList.toggle('active-kpi-filter', activeStatus === 'Goal Met');
    }
    if (elements.kpiTotalCard) {
      elements.kpiTotalCard.classList.toggle('active-kpi-filter', !activeStatus && !state.highlightAtRisk);
    }
  }

  /**
   * Renders dedicated cards for each metric, complete with Chart.js visualization.
   * Requirement 4: Clean top-bar layout preventing Metric ID and Plan pill overlaps.
   * Requirement 6: Whole card is clickable to open details modal.
   */
  function renderMetricCards(metrics) {
    destroyAllCharts();

    const container = elements.metricsGridContainer;
    container.innerHTML = '';

    if (metrics.length === 0) {
      elements.emptyState.style.display = 'block';
      return;
    }
    elements.emptyState.style.display = 'none';

    metrics.forEach(metric => {
      const card = createMetricCardElement(metric);
      container.appendChild(card);
    });

    // Initialize Chart.js for all rendered cards
    metrics.forEach(metric => {
      initCardChart(metric);
    });
  }

  function createMetricCardElement(metric) {
    const card = document.createElement('article');
    card.className = 'metric-card';
    card.setAttribute('data-id', metric.id);
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `View details for ${metric.name}`);

    // Highlight At-Risk styling
    if (metric.isAtRisk || metric.status === 'Off Track') {
      card.classList.add('at-risk-highlight');
    }

    const formattedActual = formatMetricValue(metric.latestActual, metric.unitFormat);
    const formattedTarget = metric.target !== null ? formatMetricValue(metric.target, metric.unitFormat) : metric.targetDisplay;
    const formattedBaseline = metric.baseline !== null ? formatMetricValue(metric.baseline, metric.unitFormat) : 'N/A';

    // Status Badge Markup (Requirement 2 & 2030 Predictive Model)
    let statusClass = 'tracking';
    let statusLabel = 'Tracking';
    let statusIcon = 'fa-chart-line';

    if (metric.status === 'Goal Met') {
      statusClass = 'goal-met';
      statusLabel = '2030 Met';
      statusIcon = 'fa-trophy';
    } else if (metric.predictiveStatus === 'Behind Pace for 2030') {
      statusClass = 'behind-pace';
      statusLabel = 'Behind Pace';
      statusIcon = 'fa-clock';
    } else if (metric.status === 'On Track') {
      statusClass = 'on-track';
      statusLabel = 'On Track (2030)';
      statusIcon = 'fa-circle-check';
    } else if (metric.status === 'Off Track' || metric.isAtRisk) {
      statusClass = 'off-track';
      statusLabel = 'Needs Attention';
      statusIcon = 'fa-triangle-exclamation';
    }

    // Gap Badge Markup
    let gapHtml = '';
    if (metric.gap !== null) {
      const isMet = metric.status === 'Goal Met';
      const gapClass = isMet ? 'gap-positive' : (metric.isInverseMetric ? (metric.gap <= 0 ? 'gap-positive' : 'gap-negative') : (metric.gap <= 0 ? 'gap-positive' : 'gap-negative'));
      const formattedGap = formatMetricValue(Math.abs(metric.gap), metric.unitFormat);
      const gapPrefix = isMet ? 'Met (+ ' : 'Gap: ';
      const gapSuffix = isMet ? ')' : '';
      gapHtml = `<span class="card-gap-badge ${gapClass}"><i class="fa-solid fa-scale-unbalanced"></i> ${gapPrefix}${formattedGap}${gapSuffix}</span>`;
    }

    // Progress Bar Markup
    let progressHtml = '';
    if (metric.progressPct !== null) {
      let progressColor = 'progress-green';
      if (metric.status === 'Goal Met') progressColor = 'progress-purple';
      else if (metric.status === 'Off Track') progressColor = 'progress-red';
      else if (metric.progressPct < 70) progressColor = 'progress-amber';

      progressHtml = `
        <div class="goal-progress-wrap">
          <div class="goal-progress-labels">
            <span>2030 Goal Progress</span>
            <strong>${metric.progressPct}%</strong>
          </div>
          <div class="goal-progress-track">
            <div class="goal-progress-bar ${progressColor}" style="width: ${Math.min(metric.progressPct, 100)}%;"></div>
          </div>
        </div>
      `;
    }

    // 2030 Predictive Trajectory Callout Pill
    let projectionPillHtml = '';
    if (metric.target !== null && metric.projected2030 !== null) {
      const formattedProj = formatMetricValue(metric.projected2030, metric.unitFormat);
      const formattedPace = formatRate(metric.annualSlope, metric.unitFormat);
      const isMet = metric.status === 'Goal Met';
      const pillIcon = isMet ? 'fa-trophy text-purple' : (metric.status === 'On Track' ? 'fa-arrow-trend-up text-green' : (metric.predictiveStatus === 'Behind Pace for 2030' ? 'fa-clock text-amber' : 'fa-triangle-exclamation text-red'));
      projectionPillHtml = `
        <div class="card-projection-pill" title="At current annual pace, projected to reach ${formattedProj} by 2030">
          <i class="fa-solid ${pillIcon}"></i>
          <span>Pace: <strong>${formattedPace}/yr</strong> &bull; Proj. 2030: <strong>${formattedProj}</strong></span>
        </div>
      `;
    }

    // YoY Trend Markup
    let yoyHtml = '';
    if (metric.yoyPct !== null) {
      const isUp = metric.yoyDelta > 0;
      const isGood = metric.isInverseMetric ? !isUp : isUp;
      const arrowIcon = isUp ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down';
      const colorClass = isGood ? 'text-green' : 'text-red';
      const formattedPct = `${isUp ? '+' : ''}${Math.round(metric.yoyPct * 10) / 10}%`;
      yoyHtml = `<span class="actual-year-label ${colorClass}"><i class="fa-solid ${arrowIcon}"></i> ${formattedPct} YoY</span>`;
    }

    // Plan tags (Configurable: hide Report Card pills when showOngoingReportCard is false)
    const visiblePlans = metric.plans.filter(p => CONFIG.showOngoingReportCard || !p.toLowerCase().includes('report card'));
    const planTagsHtml = visiblePlans.map(p => {
      const shortName = p.includes('Educational Master') ? 'EMP' :
                        p.includes('Strategic Plan') ? 'Strategic Plan' : 'Report Card';
      return `<span class="plan-mini-tag">${escapeHtml(shortName)}</span>`;
    }).join('');

    // Companion Headcount Subtext (Requirement 1)
    let companionHtml = '';
    if (metric.companionHeadcount !== null && metric.companionHeadcount !== undefined) {
      companionHtml = `
        <div class="companion-count-hint" style="font-size: 0.72rem; color: var(--text-muted); margin-bottom: 0.5rem;">
          <i class="fa-solid fa-users"></i> Companion Count: <strong>${Number(Math.round(metric.companionHeadcount)).toLocaleString()} students</strong>
        </div>
      `;
    }

    // Institutional Initiative Mini-Badges
    const activeInits = [];
    if (metric.vision2030) activeInits.push('<span class="initiative-pill active-initiative"><i class="fa-solid fa-eye"></i> Vision 2030</span>');
    if (metric.scff) activeInits.push('<span class="initiative-pill active-initiative"><i class="fa-solid fa-calculator"></i> SCFF</span>');
    if (metric.strongWorkforce) activeInits.push('<span class="initiative-pill"><i class="fa-solid fa-briefcase"></i> Strong Workforce</span>');
    if (metric.sea) activeInits.push('<span class="initiative-pill"><i class="fa-solid fa-scale-balanced"></i> SEA</span>');
    if (metric.accjc) activeInits.push('<span class="initiative-pill"><i class="fa-solid fa-award"></i> ACCJC</span>');
    const initiativeBadgesHtml = activeInits.length > 0 ? `<div class="initiative-tags-cluster">${activeInits.join('')}</div>` : '';

    // Requirement 4: Top-bar structured in .card-identifiers-group with .id-pill-wrapper to avoid overlap
    card.innerHTML = `
      <div class="card-top-bar">
        <div class="card-identifiers-group">
          <div class="id-pill-wrapper">
            <span class="id-pill">${escapeHtml(metric.id)}</span>
          </div>
          <div class="plan-tags-cluster">${planTagsHtml}</div>
        </div>
        <div class="card-status-wrapper">
          <span class="status-badge ${statusClass}">
            <i class="fa-solid ${statusIcon}"></i> ${statusLabel}
          </span>
        </div>
      </div>

      <h3 class="card-metric-name" title="${escapeHtml(metric.name)}">${escapeHtml(metric.name)}</h3>

      <div class="card-category-subgroup">
        <span class="category-pill">${escapeHtml(metric.categories[0] || 'General')}</span>
        ${metric.subgroup ? `<span>&bull;</span> <span class="subgroup-pill">${escapeHtml(metric.subgroup)}</span>` : ''}
      </div>

      <div class="card-stats-row">
        <div class="actual-value-wrap">
          <span class="big-actual-value">${formattedActual}</span>
          <span class="actual-year-label">(${escapeHtml(metric.latestYear)})</span>
        </div>
        ${gapHtml}
      </div>

      ${companionHtml}

      <div class="card-targets-row">
        <span class="target-stat">Baseline: <strong>${formattedBaseline}</strong></span>
        <span class="target-stat">${escapeHtml(metric.targetLabel)}: <strong>${formattedTarget}</strong></span>
        ${yoyHtml}
      </div>

      ${progressHtml}
      ${projectionPillHtml}

      <div class="card-chart-container">
        <canvas id="chart-${metric.id}"></canvas>
      </div>

      ${initiativeBadgesHtml}

      <div class="card-footer">
        <span class="pillar-tag" title="${escapeHtml(metric.pillar)}">
          <i class="fa-solid fa-signs-post"></i> ${escapeHtml(metric.pillar)}
        </span>
        <button class="details-btn" data-action="details" data-id="${metric.id}">
          <span>Details</span> <i class="fa-solid fa-arrow-right"></i>
        </button>
      </div>
    `;

    // Requirement 6: Clicking anywhere on the card opens the Details modal
    card.addEventListener('click', () => {
      openMetricModal(metric);
    });

    // Keyboard accessibility: Enter or Space triggers modal
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openMetricModal(metric);
      }
    });

    return card;
  }

  // ============================================================================
  // 5. Chart.js Data Visualization Engine
  // ============================================================================

  /**
   * Initializes a responsive mini Chart.js line or bar chart inside the metric card.
   * Visualizes historical trend (2020-21 through 2025-26), baseline, and target goal.
   */
  function initCardChart(metric) {
    const canvasId = `chart-${metric.id}`;
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const themeColors = getChartThemeColors();

    const historyLabels = metric.history.map(h => formatShortYear(h.year));
    const historyValues = metric.history.map(h => h.value);

    const hasTargetHorizon = metric.target !== null && !isNaN(metric.target) && metric.yearsRemaining > 0 && metric.projected2030 !== null;

    let labels = [...historyLabels];
    const datasets = [];

    if (hasTargetHorizon && metric.interimProjections && metric.interimProjections.length > 0) {
      // 1. Append intermediate projected labels through 2030 (e.g. '26-'27*, '27-'28*, '28-'29*, '29-'30*)
      metric.interimProjections.forEach(p => {
        labels.push(p.shortLabel);
      });

      // Dataset 1: Historical Actuals (solid line ending at latest actual, nulls for projected years)
      const actualData = [...historyValues];
      for (let i = 0; i < metric.interimProjections.length; i++) {
        actualData.push(null);
      }

      datasets.push({
        label: 'Historical Actual',
        data: actualData,
        borderColor: themeColors.lineColor,
        backgroundColor: 'rgba(153, 0, 0, 0.08)',
        fill: true,
        tension: 0.35,
        borderWidth: 2.2,
        pointRadius: 3.5,
        pointHoverRadius: 5.5,
        pointBackgroundColor: themeColors.lineColor
      });

      // Dataset 2: Adaptive Projected Trajectory (smooth line connecting through all intermediate years)
      const projData = Array(labels.length).fill(null);
      const bridgeIdx = historyValues.length - 1;
      projData[bridgeIdx] = historyValues[bridgeIdx];
      metric.interimProjections.forEach((p, idx) => {
        projData[historyValues.length + idx] = p.value;
      });

      const projColor = metric.status === 'Goal Met' ? '#7c3aed' :
                        (metric.status === 'On Track' ? '#0284c7' :
                        (metric.predictiveStatus === 'Behind Pace for 2030' ? '#f59e0b' : '#dc2626'));

      datasets.push({
        label: 'Projected Trajectory',
        data: projData,
        borderColor: projColor,
        borderDash: [5, 4],
        borderWidth: 2.2,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: projColor,
        fill: false,
        tension: 0.25
      });

      // Dataset 3: 2030 Target Diamond Marker at the horizon
      const targetData = Array(labels.length).fill(null);
      targetData[labels.length - 1] = metric.target;
      datasets.push({
        label: '2030 Target Goal',
        data: targetData,
        borderColor: '#990000',
        pointBackgroundColor: '#990000',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointStyle: 'rectRot',
        pointRadius: 6.5,
        pointHoverRadius: 8.5,
        showLine: false
      });
    } else {
      // If historical data is limited to 1 year, render a bar chart, else a curved line chart
      const chartType = metric.history.length > 2 ? 'line' : 'bar';

      datasets.push({
        label: 'Actual Value',
        data: historyValues,
        borderColor: themeColors.lineColor,
        backgroundColor: chartType === 'bar' ? 'rgba(153, 0, 0, 0.75)' : 'rgba(153, 0, 0, 0.08)',
        fill: chartType === 'line',
        tension: 0.35,
        borderWidth: 2.2,
        pointRadius: 3.5,
        pointHoverRadius: 5.5,
        pointBackgroundColor: themeColors.lineColor
      });

      // Reference Target Line (only if target exists and has matching scale)
      if (metric.target !== null && !isNaN(metric.target)) {
        datasets.push({
          label: metric.targetLabel,
          data: Array(labels.length).fill(metric.target),
          borderColor: themeColors.targetLineColor,
          borderDash: [4, 4],
          borderWidth: 1.8,
          pointRadius: 0,
          fill: false
        });
      }
    }

    const chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: themeColors.tooltipBg,
            padding: 8,
            titleFont: { size: 11, family: 'Inter' },
            bodyFont: { size: 11, family: 'Inter' },
            callbacks: {
              label: function (context) {
                const val = context.parsed.y;
                if (val === null || val === undefined) return '';
                if (context.dataset.label === '2030 Target Goal') {
                  return `2030 Target Goal: ${formatMetricValue(val, metric.unitFormat)}`;
                }
                if (context.dataset.label.includes('Projected')) {
                  if (context.dataIndex === historyValues.length - 1) {
                    return `Latest Actual (${labels[context.dataIndex]}): ${formatMetricValue(val, metric.unitFormat)}`;
                  }
                  return `Adaptive Forecast (${labels[context.dataIndex].replace('*', '')}): ${formatMetricValue(val, metric.unitFormat)}`;
                }
                return `Historical Actual: ${formatMetricValue(val, metric.unitFormat)}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            },
            ticks: {
              color: themeColors.textColor,
              font: { size: 9, family: 'Inter' }
            }
          },
          y: {
            grid: {
              color: themeColors.gridColor
            },
            ticks: {
              color: themeColors.textColor,
              font: { size: 9, family: 'Inter' },
              maxTicksLimit: 4,
              callback: function (val) {
                return formatChartTick(val, metric.unitFormat);
              }
            }
          }
        }
      }
    });

    state.chartInstances.set(canvasId, chartInstance);
  }

  function destroyAllCharts() {
    state.chartInstances.forEach(chart => {
      if (chart && typeof chart.destroy === 'function') {
        chart.destroy();
      }
    });
    state.chartInstances.clear();
  }

  function refreshAllCharts() {
    const filteredMetrics = getFilteredMetrics();
    destroyAllCharts();
    filteredMetrics.forEach(metric => {
      initCardChart(metric);
    });
  }

  // ============================================================================
  // 6. Modal / Popover Details Inspector
  // ============================================================================

  function openMetricModal(metric) {
    const m = evaluateMetricForActivePlan(metric, state.activePlan);

    elements.modalMetricId.textContent = m.id;
    elements.modalMetricName.textContent = m.name;
    elements.modalUnitBadge.textContent = m.unitFormat;

    // Status Badge
    elements.modalStatusBadge.textContent = m.status === 'Goal Met' ? '2030 Goal Met' :
                                            m.status === 'On Track' ? 'On Track (2030)' :
                                            m.predictiveStatus === 'Behind Pace for 2030' ? 'Behind Pace' :
                                            m.status === 'Off Track' ? 'Needs Attention' : 'Tracking';
    elements.modalStatusBadge.className = `status-badge ${
      m.status === 'Goal Met' ? 'goal-met' :
      (m.predictiveStatus === 'Behind Pace for 2030' ? 'behind-pace' :
      (m.status === 'On Track' ? 'on-track' : (m.status === 'Off Track' ? 'off-track' : 'tracking')))
    }`;

    // KPI Banner
    elements.modalLatestActual.textContent = formatMetricValue(m.latestActual, m.unitFormat);
    elements.modalLatestYear.textContent = m.latestYear;
    elements.modalTargetGoal.textContent = m.target !== null ? formatMetricValue(m.target, m.unitFormat) : m.targetDisplay;
    elements.modalTargetLabel.textContent = m.targetLabel;
    elements.modalBaselineValue.textContent = m.baseline !== null ? formatMetricValue(m.baseline, m.unitFormat) : 'N/A';
    elements.modalBaselineLabel.textContent = m.baselineLabel;

    if (m.gap !== null) {
      const isMet = m.status === 'Goal Met';
      elements.modalGapValue.textContent = `${isMet ? '+' : ''}${formatMetricValue(m.gap, m.unitFormat)}`;
      elements.modalGapValue.className = `stat-box-value ${isMet ? 'text-green' : 'text-chaffey'}`;
      elements.modalGapSub.textContent = isMet ? 'Goal Exceeded' : 'Remaining gap to target';
    } else {
      elements.modalGapValue.textContent = 'Tracking';
      elements.modalGapValue.className = 'stat-box-value text-muted';
      elements.modalGapSub.textContent = 'Baseline Monitoring';
    }

    // 2030 Predictive Goal Forecast Section
    if (elements.modalForecastSection) {
      if (m.target !== null && m.projected2030 !== null) {
        elements.modalForecastSection.style.display = 'flex';
        if (elements.modalForecastYearsRemaining) {
          elements.modalForecastYearsRemaining.textContent = `${m.yearsRemaining} Academic Years Remaining`;
        }
        if (elements.modalForecastTrajectory) {
          elements.modalForecastTrajectory.textContent = `${formatRate(m.annualSlope, m.unitFormat)} / yr`;
        }
        if (elements.modalForecastTrajectorySub) {
          const sign = m.annualRatePct >= 0 ? '+' : '';
          elements.modalForecastTrajectorySub.textContent = `Historical annual rate (${sign}${Math.round(m.annualRatePct * 10) / 10}% avg growth)`;
        }
        if (elements.modalForecastProjected) {
          elements.modalForecastProjected.textContent = formatMetricValue(m.projected2030, m.unitFormat);
        }
        if (elements.modalForecastTargetCompare) {
          elements.modalForecastTargetCompare.textContent = `2030 Target: ${formatMetricValue(m.target, m.unitFormat)}`;
        }
        if (elements.modalForecastRequiredPace) {
          elements.modalForecastRequiredPace.textContent = `${formatRate(m.requiredAnnualChange, m.unitFormat)} / yr`;
        }
        if (elements.modalForecastPaceStatus) {
          elements.modalForecastPaceStatus.textContent = m.status === 'Goal Met' ? '2030 Goal Exceeded' :
            (m.status === 'On Track' ? 'Ahead of required pace' : 'Behind required pace');
        }
        if (elements.modalForecastVerdictText) {
          elements.modalForecastVerdictText.textContent = m.verdict;
        }
        if (elements.modalForecastVerdictBox) {
          elements.modalForecastVerdictBox.className = `forecast-verdict-box ${
            m.status === 'Goal Met' || m.status === 'On Track' ? 'verdict-on-track' :
            (m.predictiveStatus === 'Behind Pace for 2030' ? 'verdict-behind-pace' : 'verdict-off-track')
          }`;
        }
        if (elements.modalForecastVerdictIcon) {
          elements.modalForecastVerdictIcon.className = `fa-solid ${
            m.status === 'Goal Met' ? 'fa-trophy text-purple' :
            (m.status === 'On Track' ? 'fa-circle-check text-green' : 'fa-triangle-exclamation text-amber')
          }`;
        }

        // Annual Projected Pathway Steps
        if (elements.modalForecastPathwaySteps && elements.modalForecastPathwayContainer) {
          if (m.interimProjections && m.interimProjections.length > 0) {
            elements.modalForecastPathwayContainer.style.display = 'flex';
            elements.modalForecastPathwaySteps.innerHTML = m.interimProjections.map((p, idx) => {
              const isLast = idx === m.interimProjections.length - 1;
              const formattedVal = formatMetricValue(p.value, m.unitFormat);
              return `
                <div class="forecast-pathway-step ${p.isTargetDeadline ? 'step-deadline' : ''}">
                  <span class="step-year">${escapeHtml(p.fullLabel)}:</span>
                  <strong>${formattedVal}</strong>
                  ${p.isTargetDeadline ? '<i class="fa-solid fa-flag-checkered"></i>' : ''}
                </div>
                ${!isLast ? '<i class="fa-solid fa-chevron-right forecast-pathway-arrow"></i>' : ''}
              `;
            }).join('');
          } else {
            elements.modalForecastPathwayContainer.style.display = 'none';
          }
        }
      } else {
        elements.modalForecastSection.style.display = 'none';
        if (elements.modalForecastPathwayContainer) {
          elements.modalForecastPathwayContainer.style.display = 'none';
        }
      }
    }

    // Context & Governance
    elements.modalDefinition.textContent = m.definition;
    const visiblePlansModal = m.plans.filter(p => CONFIG.showOngoingReportCard || !p.toLowerCase().includes('report card'));
    elements.modalPlanAlignment.textContent = visiblePlansModal.join(', ') || 'Districtwide Master Plan';
    elements.modalGoalArea.textContent = [...m.empGoals, ...m.spGoals, ...m.empPlanAreas].join('; ') || 'Institutional Performance';
    elements.modalDataSource.textContent = m.dataSource;
    elements.modalResponsible.textContent = m.responsible;
    elements.modalDisaggregation.textContent = m.subgroup || 'Total Districtwide';
    elements.modalNotes.textContent = m.notes || 'No specific notes recorded in template.';

    // Modal Institutional Initiative Badges
    if (elements.modalInitiativeBadges) {
      elements.modalInitiativeBadges.innerHTML = '';
      const inits = [
        { label: 'Vision 2030', active: m.vision2030, icon: 'fa-eye' },
        { label: 'Student Centered Funding Formula (SCFF)', active: m.scff, icon: 'fa-calculator' },
        { label: 'Strong Workforce Program', active: m.strongWorkforce, icon: 'fa-briefcase' },
        { label: 'Student Equity & Achievement (SEA)', active: m.sea, icon: 'fa-scale-balanced' },
        { label: 'ACCJC Standards', active: m.accjc, icon: 'fa-award' }
      ];
      inits.forEach(init => {
        const badge = document.createElement('span');
        badge.className = `initiative-pill ${init.active ? 'active-initiative' : ''}`;
        badge.innerHTML = `<i class="fa-solid ${init.icon}"></i> ${init.label}: <strong>${init.active ? 'Aligned (Y)' : 'N'}</strong>`;
        elements.modalInitiativeBadges.appendChild(badge);
      });
    }

    if (elements.modalDatePulled) {
      elements.modalDatePulled.textContent = m.datePulled || 'October 22, 2026';
    }

    // Populate Multi-year Historical Data Table
    populateModalHistoryTable(m);

    // Render Large Modal Trajectory Chart
    renderModalTrajectoryChart(m);

    // Show modal with accessibility
    elements.metricDetailModal.style.display = 'flex';
    elements.metricDetailModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    elements.metricDetailModal.style.display = 'none';
    elements.metricDetailModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';

    if (state.modalChartInstance) {
      state.modalChartInstance.destroy();
      state.modalChartInstance = null;
    }
  }

  function populateModalHistoryTable(m) {
    const tbody = elements.modalHistoryTable.querySelector('tbody');
    tbody.innerHTML = '';

    const tr = document.createElement('tr');
    HISTORICAL_YEARS.forEach(year => {
      const td = document.createElement('td');
      const point = m.history.find(h => h.year === year);
      td.textContent = point ? formatMetricValue(point.value, m.unitFormat) : '—';
      tr.appendChild(td);
    });

    const tdBaseline = document.createElement('td');
    tdBaseline.textContent = m.baseline !== null ? formatMetricValue(m.baseline, m.unitFormat) : '—';
    tr.appendChild(tdBaseline);

    const tdTarget = document.createElement('td');
    tdTarget.textContent = m.target !== null ? formatMetricValue(m.target, m.unitFormat) : m.targetDisplay;
    tdTarget.className = 'text-chaffey font-bold';
    tr.appendChild(tdTarget);

    tbody.appendChild(tr);
  }

  function renderModalTrajectoryChart(m) {
    if (state.modalChartInstance) {
      state.modalChartInstance.destroy();
      state.modalChartInstance = null;
    }

    const canvas = elements.modalTrendCanvas;
    const ctx = canvas.getContext('2d');
    const themeColors = getChartThemeColors();

    const has2030Forecast = m.target !== null && !isNaN(m.target) && m.projected2030 !== null && m.yearsRemaining > 0;

    const historyLabels = m.history.map(h => formatShortYear(h.year));
    const historyValues = m.history.map(h => h.value);

    let labels = [...historyLabels];
    const datasets = [];

    if (has2030Forecast && m.interimProjections && m.interimProjections.length > 0) {
      // 1. Append intermediate projected year labels through 2030
      m.interimProjections.forEach(p => {
        labels.push(p.shortLabel);
      });

      const actualData = [...historyValues];
      for (let i = 0; i < m.interimProjections.length; i++) {
        actualData.push(null);
      }

      datasets.push({
        label: 'Historical Actual',
        data: actualData,
        borderColor: '#990000',
        backgroundColor: 'rgba(153, 0, 0, 0.08)',
        fill: true,
        tension: 0.3,
        borderWidth: 3,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: '#990000'
      });

      // Dataset 2: Multi-Year Adaptive Projected Trajectory (smooth curve through all intermediate years)
      const projData = Array(labels.length).fill(null);
      const bridgeIdx = historyValues.length - 1;
      projData[bridgeIdx] = historyValues[bridgeIdx];
      m.interimProjections.forEach((p, idx) => {
        projData[historyValues.length + idx] = p.value;
      });

      const projColor = m.status === 'Goal Met' ? '#7c3aed' :
                        (m.status === 'On Track' ? '#0284c7' :
                        (m.predictiveStatus === 'Behind Pace for 2030' ? '#f59e0b' : '#dc2626'));

      datasets.push({
        label: `Adaptive Projected Trajectory (${formatMetricValue(m.projected2030, m.unitFormat)} in 2030)`,
        data: projData,
        borderColor: projColor,
        borderDash: [5, 4],
        borderWidth: 2.8,
        pointRadius: 5.5,
        pointHoverRadius: 8,
        pointBackgroundColor: projColor,
        fill: false,
        tension: 0.25
      });

      // Dataset 3: 2030 Target Goal Diamond Marker at the horizon
      const targetPointData = Array(labels.length).fill(null);
      targetPointData[labels.length - 1] = m.target;
      datasets.push({
        label: `2030 Target Goal (${formatMetricValue(m.target, m.unitFormat)})`,
        data: targetPointData,
        borderColor: '#990000',
        pointBackgroundColor: '#990000',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2.5,
        pointStyle: 'rectRot',
        pointRadius: 9,
        pointHoverRadius: 11,
        showLine: false
      });
    } else {
      datasets.push({
        label: 'Historical Actual',
        data: historyValues,
        borderColor: '#990000',
        backgroundColor: 'rgba(153, 0, 0, 0.1)',
        fill: true,
        tension: 0.3,
        borderWidth: 3,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: '#990000'
      });

      if (m.target !== null) {
        datasets.push({
          label: `${m.targetLabel} (${formatMetricValue(m.target, m.unitFormat)})`,
          data: Array(labels.length).fill(m.target),
          borderColor: '#0284c7',
          borderDash: [6, 6],
          borderWidth: 2,
          pointRadius: 0,
          fill: false
        });
      }
    }

    if (m.baseline !== null) {
      datasets.push({
        label: `Baseline (${formatMetricValue(m.baseline, m.unitFormat)})`,
        data: Array(labels.length).fill(m.baseline),
        borderColor: '#64748b',
        borderDash: [3, 3],
        borderWidth: 1.5,
        pointRadius: 0,
        fill: false
      });
    }

    state.modalChartInstance = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: themeColors.textColor,
              font: { family: 'Inter', size: 12, weight: 600 }
            }
          },
          tooltip: {
            backgroundColor: themeColors.tooltipBg,
            padding: 10,
            callbacks: {
              label: function (ctx) {
                const val = ctx.parsed.y;
                if (val === null || val === undefined) return '';
                if (ctx.dataset.label.includes('2030 Target Goal')) {
                  return `2030 Target Goal: ${formatMetricValue(val, m.unitFormat)}`;
                }
                if (ctx.dataset.label.includes('Adaptive Projected Trajectory')) {
                  if (ctx.dataIndex === historyValues.length - 1) {
                    return `Historical Anchor (${labels[ctx.dataIndex]}): ${formatMetricValue(val, m.unitFormat)}`;
                  }
                  return `Adaptive Forecast (${labels[ctx.dataIndex].replace('*', '')}): ${formatMetricValue(val, m.unitFormat)}`;
                }
                return `Historical Actual (${labels[ctx.dataIndex]}): ${formatMetricValue(val, m.unitFormat)}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: themeColors.gridColor },
            ticks: { color: themeColors.textColor, font: { family: 'Inter' } }
          },
          y: {
            grid: { color: themeColors.gridColor },
            ticks: {
              color: themeColors.textColor,
              font: { family: 'Inter' },
              callback: function (val) {
                return formatChartTick(val, m.unitFormat);
              }
            }
          }
        }
      }
    });
  }

  // ============================================================================
  // 7. Export Functionality (html2canvas & jsPDF)
  // ============================================================================

  async function exportDashboardAsPng() {
    showToast('Generating high-resolution PNG snapshot...', 'info');

    try {
      const target = elements.dashboardCaptureTarget;
      const originalScrollTop = window.scrollY;

      const canvas = await html2canvas(target, {
        scale: 2,
        useCORS: true,
        backgroundColor: state.theme === 'dark' ? '#0b1120' : '#f8fafc',
        logging: false
      });

      const dateStr = new Date().toISOString().split('T')[0];
      const planSlug = state.activePlan.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `Chaffey_Plan_Metrics_${planSlug}_${dateStr}.png`;

      const link = document.createElement('a');
      link.download = filename;
      link.href = canvas.toDataURL('image/png');
      link.click();

      showToast('PNG dashboard export downloaded successfully!', 'success');
      window.scrollTo(0, originalScrollTop);
    } catch (err) {
      console.error('PNG export error:', err);
      showToast(`Failed to export PNG: ${err.message}`, 'error');
    }
  }

  async function exportDashboardAsPdf() {
    showToast('Compiling executive PDF report...', 'info');

    try {
      const target = elements.dashboardCaptureTarget;
      const { jsPDF } = window.jspdf;

      const canvas = await html2canvas(target, {
        scale: 2,
        useCORS: true,
        backgroundColor: state.theme === 'dark' ? '#0b1120' : '#f8fafc',
        logging: false
      });

      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;

      const pdf = new jsPDF('p', 'mm', 'a4');
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const dateStr = new Date().toISOString().split('T')[0];
      const planSlug = state.activePlan.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `Chaffey_Plan_Metrics_${planSlug}_${dateStr}.pdf`;

      pdf.save(filename);
      showToast('PDF report generated and downloaded!', 'success');
    } catch (err) {
      console.error('PDF export error:', err);
      showToast(`Failed to export PDF: ${err.message}`, 'error');
    }
  }

  // ============================================================================
  // Event Listeners & UI Interactions
  // ============================================================================

  function setupEventListeners() {
    // Theme Toggle
    elements.themeToggleBtn.addEventListener('click', toggleTheme);

    // File Upload Trigger Buttons
    elements.uploadTriggerBtn.addEventListener('click', () => {
      elements.spreadsheetFileInput.click();
    });
    elements.browseFileBtn.addEventListener('click', () => {
      elements.spreadsheetFileInput.click();
    });
    elements.spreadsheetFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleFileUpload(e.target.files[0]);
      }
    });

    // Drag and Drop Handling
    const dropZone = elements.uploadDropZone;
    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drag-over');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
      }, false);
    });

    dropZone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      if (dt.files && dt.files[0]) {
        handleFileUpload(dt.files[0]);
      }
    });

    // Plan Navigation Tabs
    elements.planTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        elements.planTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        state.activePlan = tab.getAttribute('data-plan');

        // Reset cascading filters when switching plans to prevent mismatched cascading
        elements.categoryFilter.value = '';
        elements.pillarFilter.value = '';
        elements.goalFilter.value = '';
        if (elements.areaFilter) elements.areaFilter.value = '';
        elements.modalityFilter.value = '';
        if (elements.initiativeFilter) elements.initiativeFilter.value = '';
        state.activeFilters.category = '';
        state.activeFilters.pillar = '';
        state.activeFilters.goal = '';
        state.activeFilters.area = '';
        state.activeFilters.modality = '';
        state.activeFilters.initiative = '';

        populateFilterDropdowns();
        renderDashboard();
      });
    });

    // Sidebar Collapse / Expand (Requirement 2)
    if (elements.collapseSidebarBtn && elements.dashboardSidebar) {
      elements.collapseSidebarBtn.addEventListener('click', () => {
        elements.dashboardSidebar.classList.add('collapsed');
        if (elements.expandSidebarBtn) elements.expandSidebarBtn.style.display = 'inline-flex';
        // Trigger resize so Chart.js cards dynamically reflow to fill space
        setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
      });
    }

    if (elements.expandSidebarBtn && elements.dashboardSidebar) {
      elements.expandSidebarBtn.addEventListener('click', () => {
        elements.dashboardSidebar.classList.remove('collapsed');
        elements.expandSidebarBtn.style.display = 'none';
        setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
      });
    }

    // Requirement 3: Highlight At-Risk Toggle (Automatically filters to show ONLY At-Risk Metrics)
    elements.atRiskToggle.addEventListener('change', (e) => {
      state.highlightAtRisk = e.target.checked;
      renderDashboard();
    });

    // Requirement 7: KPI Quick View Card Filtering (ON TRACK, AT-RISK, TARGET ACHIEVED, TOTAL)
    function toggleKpiStatusFilter(statusVal) {
      if (state.activeFilters.status === statusVal) {
        state.activeFilters.status = '';
        elements.statusFilter.value = '';
      } else {
        state.activeFilters.status = statusVal;
        elements.statusFilter.value = statusVal;
      }
      if (statusVal !== 'Off Track' && state.highlightAtRisk) {
        state.highlightAtRisk = false;
        elements.atRiskToggle.checked = false;
      }
      renderDashboard();
    }

    if (elements.kpiTotalCard) {
      elements.kpiTotalCard.addEventListener('click', () => {
        state.activeFilters.status = '';
        elements.statusFilter.value = '';
        state.highlightAtRisk = false;
        elements.atRiskToggle.checked = false;
        renderDashboard();
      });
    }

    if (elements.kpiOnTrackCard) {
      elements.kpiOnTrackCard.addEventListener('click', () => {
        toggleKpiStatusFilter('On Track');
      });
    }

    if (elements.kpiAtRiskCard) {
      elements.kpiAtRiskCard.addEventListener('click', () => {
        toggleKpiStatusFilter('Off Track');
      });
    }

    if (elements.kpiGoalsMetCard) {
      elements.kpiGoalsMetCard.addEventListener('click', () => {
        toggleKpiStatusFilter('Goal Met');
      });
    }

    // Export Dropdown Trigger
    elements.exportDropdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      elements.exportMenu.classList.toggle('show');
    });

    document.addEventListener('click', () => {
      elements.exportMenu.classList.remove('show');
    });

    elements.exportPngBtn.addEventListener('click', () => {
      elements.exportMenu.classList.remove('show');
      exportDashboardAsPng();
    });

    elements.exportPdfBtn.addEventListener('click', () => {
      elements.exportMenu.classList.remove('show');
      exportDashboardAsPdf();
    });

    // Filter Controls
    elements.metricSearchInput.addEventListener('input', (e) => {
      state.activeFilters.search = e.target.value.trim();
      elements.searchClearBtn.style.display = state.activeFilters.search ? 'block' : 'none';
      renderDashboard();
    });

    elements.searchClearBtn.addEventListener('click', () => {
      elements.metricSearchInput.value = '';
      state.activeFilters.search = '';
      elements.searchClearBtn.style.display = 'none';
      renderDashboard();
    });

    elements.categoryFilter.addEventListener('change', (e) => {
      state.activeFilters.category = e.target.value;
      renderDashboard();
    });

    elements.pillarFilter.addEventListener('change', (e) => {
      state.activeFilters.pillar = e.target.value;
      renderDashboard();
    });

    elements.goalFilter.addEventListener('change', (e) => {
      state.activeFilters.goal = e.target.value;
      renderDashboard();
    });

    if (elements.areaFilter) {
      elements.areaFilter.addEventListener('change', (e) => {
        state.activeFilters.area = e.target.value;
        renderDashboard();
      });
    }

    elements.modalityFilter.addEventListener('change', (e) => {
      state.activeFilters.modality = e.target.value;
      renderDashboard();
    });

    if (elements.initiativeFilter) {
      elements.initiativeFilter.addEventListener('change', (e) => {
        state.activeFilters.initiative = e.target.value;
        renderDashboard();
      });
    }

    elements.statusFilter.addEventListener('change', (e) => {
      state.activeFilters.status = e.target.value;
      renderDashboard();
    });

    elements.resetFiltersBtn.addEventListener('click', resetAllFilters);
    elements.emptyResetBtn.addEventListener('click', resetAllFilters);

    // Quick Filter Chips
    elements.quickChips.forEach(chip => {
      chip.addEventListener('click', () => {
        elements.quickChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        state.activeFilters.quickChip = chip.getAttribute('data-chip');
        renderDashboard();
      });
    });

    // View Density Controls
    elements.viewGridBtn.addEventListener('click', () => {
      elements.viewGridBtn.classList.add('active');
      elements.viewListBtn.classList.remove('active');
      elements.metricsGridContainer.style.gridTemplateColumns = 'repeat(auto-fill, minmax(360px, 1fr))';
    });

    elements.viewListBtn.addEventListener('click', () => {
      elements.viewListBtn.classList.add('active');
      elements.viewGridBtn.classList.remove('active');
      elements.metricsGridContainer.style.gridTemplateColumns = '1fr';
    });

    // Modal Close Triggers
    elements.modalCloseBtn.addEventListener('click', closeModal);
    elements.modalCloseFooterBtn.addEventListener('click', closeModal);
    elements.metricDetailModal.addEventListener('click', (e) => {
      if (e.target === elements.metricDetailModal) {
        closeModal();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && elements.metricDetailModal.style.display !== 'none') {
        closeModal();
      }
    });
  }

  function resetAllFilters() {
    state.activeFilters = {
      search: '',
      category: '',
      pillar: '',
      goal: '',
      area: '',
      modality: '',
      initiative: '',
      status: '',
      quickChip: 'all'
    };
    state.highlightAtRisk = false;
    if (elements.atRiskToggle) elements.atRiskToggle.checked = false;

    elements.metricSearchInput.value = '';
    elements.searchClearBtn.style.display = 'none';
    elements.categoryFilter.value = '';
    elements.pillarFilter.value = '';
    elements.goalFilter.value = '';
    if (elements.areaFilter) elements.areaFilter.value = '';
    elements.modalityFilter.value = '';
    if (elements.initiativeFilter) elements.initiativeFilter.value = '';
    elements.statusFilter.value = '';

    elements.quickChips.forEach(c => c.classList.remove('active'));
    const defaultChip = document.querySelector('[data-chip="all"]');
    if (defaultChip) defaultChip.classList.add('active');

    renderDashboard();
  }

  function updateActiveFilterBadge() {
    let count = 0;
    const f = state.activeFilters;
    if (f.search) count++;
    if (f.category) count++;
    if (f.pillar) count++;
    if (f.goal) count++;
    if (f.area) count++;
    if (f.modality) count++;
    if (f.initiative) count++;
    if (f.status) count++;
    if (f.quickChip && f.quickChip !== 'all') count++;
    if (state.highlightAtRisk) count++;

    if (elements.filterActiveCount) {
      elements.filterActiveCount.textContent = count === 0 ? '0 filters applied' : `${count} filter${count > 1 ? 's' : ''} applied`;
    }
  }

  // ============================================================================
  // Formatting Helpers & Utilities (Requirement 1 Safeguard)
  // ============================================================================

  /**
   * Requirement 1 Safeguard: Prevents student headcounts from ever formatting as percentages.
   */
  function formatMetricValue(val, unitFormat) {
    if (val === null || val === undefined || isNaN(val)) return '—';

    const format = (unitFormat || '').toLowerCase();

    // Guard: If value is greater than 100 and unit mentions count or headcount, it is a student count!
    if (val > 100 && (format.includes('count') || format.includes('headcount'))) {
      return Number(Math.round(val)).toLocaleString();
    }

    if (format.includes('percentage') || format.includes('percent')) {
      // If value is greater than 1.0 and unit contains count, it is a headcount
      if (val > 1.0 && format.includes('count')) {
        return Number(Math.round(val)).toLocaleString();
      }
      const pct = val <= 1 && val >= -1 ? val * 100 : val;
      return `${Math.round(pct * 10) / 10}%`;
    }

    if (format.includes('decimal') || format.includes('ftes') || format.includes('ratio')) {
      return Number(val).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 });
    }

    // Default integer count
    return Number(Math.round(val)).toLocaleString();
  }

  function formatChartTick(val, unitFormat) {
    const format = (unitFormat || '').toLowerCase();
    if (format.includes('percentage')) {
      if (val <= 1 && val >= -1) return `${Math.round(val * 100)}%`;
      if (val <= 100 && !format.includes('count')) return `${Math.round(val)}%`;
    }
    if (val >= 1000) {
      return `${Math.round(val / 100) / 10}k`;
    }
    return val;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function showToast(message, type = 'info') {
    const container = elements.toastContainer;
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-triangle-exclamation';

    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // ============================================================================
  // Initialize App on DOM Ready
  // ============================================================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
