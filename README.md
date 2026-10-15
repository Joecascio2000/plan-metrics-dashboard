# Chaffey College - Institutional Plan Metrics & Goal-Tracking Dashboard

An interactive, client-side web application built for **Chaffey Community College District** to process, visualize, and track institutional planning metrics, baseline horizons, and target goals.

The dashboard reads strictly from the primary **master** sheet of `unified_plan_metrics_template.xlsx` and provides rich dynamic visualization, multi-plan grouping, cascading filters, alert detection for at-risk metrics, and one-click PDF/PNG exporting.

---

## 🌟 Key Features

### 1. Data Parsing & Handling (SheetJS Integration)
- **Primary Master Sheet Enforcement:** The application strictly reads from the primary `master` data sheet (case-insensitive detection), ignoring supplementary sheets.
- **Client-Side Processing:** Built completely client-side with SheetJS (`xlsx.full.min.js`), meaning no data leaves the browser, ensuring compliance with institutional privacy and data governance.
- **Drag & Drop Upload:** Leadership and researchers can drag-and-drop updated `.xlsx` or `.csv` files directly onto the dashboard for real-time recalculation.
- **Instant Pre-loaded Dataset:** Includes pre-compiled data from `unified_plan_metrics_template.xlsx` (`defaultData.js`) so the dashboard works instantly out-of-the-box on local files and GitHub Pages.

### 2. Multi-Plan Grouping & Navigation
The application organizes institutional metrics into dedicated, navigable plan tabs:
- **All Plans (Unified Master View):** Primary first tab and active by default on load, unifying active institutional metrics across the Educational Master Plan and Strategic Plan (2026–2030).
- **Educational Master Plan (EMP):** 29 metrics focused on scheduling efficiency, location capacity (Chino, Fontana, Rancho), course fill rates, and student access aligned with 2025–2026 Yr 0 baselines.
- **Strategic Plan (2026–2030):** 16 core metrics centered on the 4 institutional strategic goals: Student Success, Ensured Learning, Career Pathways, and Inclusive Equity with 2024–2025 Yr 0 baselines.
- **Ongoing Report Card (Configurable):** Preserved in the codebase and configurable via `CONFIG.showOngoingReportCard` in `app.js` (hidden by default, can be toggled on anytime to show multi-year trend metrics from 2020–2021 through 2025–2026).

### 3. Dynamic Calculation Engine
- **Latest Actual Value:** Dynamically identifies the most recent non-null year's actual value across historical reporting cycles (`2020-21` through `2025-26`).
- **Baseline Alignment:** Dynamically links the appropriate plan baseline (`EMP Baseline 2025-2026 Yr 0` or `Strategic Plan Baseline 2024-2025 Yr 0`).
- **Target Goal Parsing:** Intelligently normalizes target values whether formatted as decimals (e.g. `0.80`), integers (`3264`), ratios (`15.0`), percentages (`75%`), or compound growth trajectories (`"1% per year"` / `"Increase 1% per year"`).
- **Variance & Numerical Gap:** 
  - Standard metrics: $\text{Gap} = \text{Target} - \text{Latest Actual}$ (remaining distance to target).
  - Inverse metrics (e.g., *Average Units Accumulated* M-031, M-032, M-033): $\text{Gap} = \text{Latest Actual} - \text{Target}$ (excess units requiring reduction).
- **Status Determination:**
  - **Goal Met:** Target achieved or exceeded.
  - **On Track:** Positive trajectory moving toward target, or $\ge 80\%$ of goal horizon.
  - **Off Track / At-Risk:** Latest actual moving away from target or underperforming baseline.
  - **Tracking:** Baseline metrics undergoing initial monitoring.

### 4. Collapsible Sidebar & Dynamic Responsive Layout
- **Collapsible Left Filter Sidebar:** Positioned on the left side of the dashboard, expanded by default and smoothly collapsible via the toggle button (`<i class="fa-solid fa-chevron-left"></i>`).
- **Dynamic Metric Cards Reflow:** The card container uses CSS Grid (`repeat(auto-fill, minmax(360px, 1fr))`) to adapt dynamically to available width. When the sidebar is expanded, 2 cards fit side-by-side; when collapsed/hidden, 3 to 4 cards reflow to fill the full screen width.
- **Dedicated, Separated Filters:**
  - **Plan Goal:** Dedicated dropdown populated with individual goals split by semicolon (e.g. `1: Success`, `2: Learning`, `3: Career`, `4: Equity`, or EMP Goals).
  - **Plan Area / Objective:** Dedicated dropdown placed right below Plan Goal for specific objectives and focus areas.
  - **Guided Pathways Alignment:** Strategic Pillars (Pillars I–IV).
  - **Modality & Subgroups:** Dynamically populated based on the active Plan tab—only options with at least 1 matching metric are displayed (e.g. Online and In-Person on EMP; Math/English, CPL, Skill Tokens, ILOs on Strategic Plan; Demographics and Special Populations on Report Card).
- **Interactive KPI Card Filters:** Clicking on the high-level KPI cards (Filtered Total, On Track, At-Risk, Targets Achieved) instantly filters the visible cards.

### 5. Goal Status & Alert Detection ("Highlight At-Risk Metrics")
- Leadership toggle switch automatically filters the dashboard to display only metrics requiring attention.
- Metrics without target horizons are safely categorized as `Tracking` (baseline monitoring) without triggering false at-risk alerts.
- Off-track metrics receive an alert border, animated warning badges (`⚠️ Needs Attention`), and high-visibility status indicators.

### 6. Export Functionality
- **Export as PNG:** Uses `html2canvas` to render high-resolution raster snapshots of the active dashboard state.
- **Export as PDF:** Uses `html2canvas` and `jsPDF` to compile executive multi-page PDF reports complete with Chaffey College branding, active plan tabs, and filter criteria.

### 7. Chaffey College Branding & Themes
- Official district color palette: Chaffey Red (`#990000`), Navy Blue (`#1d4ed8`), Gold/Amber (`#d97706`), White, and Slate.
- Light & Dark mode switch with seamless CSS variable transitions and dynamic Chart.js grid and text synchronization.

---

## 📂 File Structure

```
plan-metrics-dashboard/
├── index.html        # Semantic HTML5 dashboard layout, header, tabs, and modals
├── styles.css        # Chaffey College design system, CSS variables, dark/light themes
├── app.js            # Core application logic, SheetJS parser, calculations, Chart.js
├── defaultData.js    # Pre-compiled 100-metric master sheet dataset for instant startup
├── unified_plan_metrics_template.xlsx  # Master institutional data spreadsheet
└── README.md         # Architecture and documentation
```

---

## 🚀 Running Locally or on GitHub Pages

Because this application is 100% client-side with zero server dependencies, it can be run:

1. **Locally:** Simply open `index.html` in any modern web browser (Chrome, Edge, Firefox, Safari).
2. **Via Local Server (Optional):**
   ```bash
   python -m http.server 8000
   ```
   Navigate to `http://localhost:8000/`.
3. **On GitHub Pages:**
   - Commit and push files to your GitHub repository `Joecascio2000/plan-metrics-dashboard`.
   - In GitHub Settings > Pages, select the `main` branch as the build source.
   - Your live dashboard will be instantly available at:
     `https://joecascio2000.github.io/plan-metrics-dashboard/`

---

## 🏛️ Institutional Alignment
- **Educational Master Plan (EMP):** 2025–2026 Baseline Horizons.
- **Strategic Plan (2026–2030):** Goals 1–4, SCFF Alignment, Vision 2030.
- **Guided Pathways:** Pillars I, II, III, & IV.
- **Data Governance:** Executive Director, Institutional Research.
