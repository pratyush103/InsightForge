import { create } from 'zustand';
import type {
  CrossFilterState,
  DashboardWidgetSpec,
  GridCoordinates,
  PipelineManifest,
  SchemaCatalog,
  TableProfile,
} from '../types/insightforge';
import type {
  ConversationMessage,
  DashboardPageSpec,
  DataSourceConfig,
  EmbeddedCsvTable,
  InsightForgeProject,
  VirtualRelation,
  WidgetScopeState,
} from '../types/project';
import { exportProjectToIFPF, importProjectFromIFPF } from '../lib/ifpf';

const STORAGE_KEY = 'insightforge_projects_v1';

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'proj-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now().toString(36);
}

const SAMPLE_SCHEMA_CATALOG: SchemaCatalog = {
  connector_id: 'default_sqlite_commerce',
  connector_name: 'SaaS & Global Commerce SQLite',
  dialect: 'sqlite',
  database_display: 'saas_commerce.db',
  schema_fingerprint: 'sha256:9f84c2a10d7e4b6c93a8f12e4b018c7d',
  tables: [
    {
      table_name: 'customers',
      row_count: 1240,
      description: 'Enterprise, Mid-Market, and SMB accounts across global operating regions.',
      columns: [
        {
          name: 'customer_id',
          data_type: 'VARCHAR(36)',
          nullable: false,
          is_primary_key: true,
          is_foreign_key: false,
          foreign_key_target: null,
          distinct_count: 1240,
          null_count: 0,
          min_value: 'CUST-1001',
          max_value: 'CUST-2240',
          sample_values: ['CUST-1001', 'CUST-1042', 'CUST-1108'],
        },
        {
          name: 'company_name',
          data_type: 'VARCHAR(120)',
          nullable: false,
          is_primary_key: false,
          is_foreign_key: false,
          foreign_key_target: null,
          distinct_count: 1240,
          null_count: 0,
          min_value: 'Aether Dynamics',
          max_value: 'Zephyr Cloud Corp',
          sample_values: ['Aether Dynamics', 'Northstar FinTech', 'Vanguard Retail'],
        },
        {
          name: 'region',
          data_type: 'VARCHAR(32)',
          nullable: false,
          is_primary_key: false,
          is_foreign_key: false,
          foreign_key_target: null,
          distinct_count: 4,
          null_count: 0,
          min_value: 'APAC',
          max_value: 'North America',
          sample_values: ['North America', 'EMEA', 'APAC', 'LATAM'],
        },
        {
          name: 'segment',
          data_type: 'VARCHAR(32)',
          nullable: false,
          is_primary_key: false,
          is_foreign_key: false,
          foreign_key_target: null,
          distinct_count: 3,
          null_count: 0,
          min_value: 'Enterprise',
          max_value: 'SMB',
          sample_values: ['Enterprise', 'Mid-Market', 'SMB'],
        },
        {
          name: 'health_score',
          data_type: 'INTEGER',
          nullable: false,
          is_primary_key: false,
          is_foreign_key: false,
          foreign_key_target: null,
          distinct_count: 78,
          null_count: 0,
          min_value: 22,
          max_value: 99,
          sample_values: [92, 84, 67],
        },
        {
          name: 'created_at',
          data_type: 'DATE',
          nullable: false,
          is_primary_key: false,
          is_foreign_key: false,
          foreign_key_target: null,
          distinct_count: 410,
          null_count: 0,
          min_value: '2024-01-04',
          max_value: '2026-10-28',
          sample_values: ['2024-03-15', '2025-01-20', '2026-06-11'],
        },
      ],
      sample_rows: [
        {
          customer_id: 'CUST-1001',
          company_name: 'Aether Dynamics',
          region: 'North America',
          segment: 'Enterprise',
          health_score: 94,
          created_at: '2024-03-15',
        },
        {
          customer_id: 'CUST-1002',
          company_name: 'Northstar FinTech',
          region: 'EMEA',
          segment: 'Enterprise',
          health_score: 88,
          created_at: '2024-07-09',
        },
      ],
    },
    {
      table_name: 'subscriptions',
      row_count: 1480,
      description: 'Recurring SaaS subscription contracts, MRR/ARR commitments, and churn status.',
      columns: [
        {
          name: 'subscription_id',
          data_type: 'VARCHAR(36)',
          nullable: false,
          is_primary_key: true,
          is_foreign_key: false,
          foreign_key_target: null,
          distinct_count: 1480,
          null_count: 0,
          min_value: 'SUB-5001',
          max_value: 'SUB-6480',
          sample_values: ['SUB-5001', 'SUB-5019', 'SUB-5104'],
        },
        {
          name: 'customer_id',
          data_type: 'VARCHAR(36)',
          nullable: false,
          is_primary_key: false,
          is_foreign_key: true,
          foreign_key_target: 'customers.customer_id',
          distinct_count: 1240,
          null_count: 0,
          min_value: 'CUST-1001',
          max_value: 'CUST-2240',
          sample_values: ['CUST-1001', 'CUST-1042'],
        },
        {
          name: 'plan_tier',
          data_type: 'VARCHAR(32)',
          nullable: false,
          is_primary_key: false,
          is_foreign_key: false,
          foreign_key_target: null,
          distinct_count: 4,
          null_count: 0,
          min_value: 'Enterprise Plus',
          max_value: 'Starter',
          sample_values: ['Enterprise Plus', 'Growth', 'Scale', 'Starter'],
        },
        {
          name: 'mrr',
          data_type: 'DECIMAL(12,2)',
          nullable: false,
          is_primary_key: false,
          is_foreign_key: false,
          foreign_key_target: null,
          distinct_count: 340,
          null_count: 0,
          min_value: 250,
          max_value: 28500,
          sample_values: [14200, 8500, 3200],
        },
        {
          name: 'status',
          data_type: 'VARCHAR(24)',
          nullable: false,
          is_primary_key: false,
          is_foreign_key: false,
          foreign_key_target: null,
          distinct_count: 3,
          null_count: 0,
          min_value: 'active',
          max_value: 'past_due',
          sample_values: ['active', 'churned', 'past_due'],
        },
        {
          name: 'renewal_date',
          data_type: 'DATE',
          nullable: true,
          is_primary_key: false,
          is_foreign_key: false,
          foreign_key_target: null,
          distinct_count: 295,
          null_count: 42,
          min_value: '2026-01-01',
          max_value: '2027-06-30',
          sample_values: ['2026-12-15', '2027-03-01'],
        },
      ],
      sample_rows: [
        {
          subscription_id: 'SUB-5001',
          customer_id: 'CUST-1001',
          plan_tier: 'Enterprise Plus',
          mrr: 14200,
          status: 'active',
          renewal_date: '2026-12-15',
        },
      ],
    },
    {
      table_name: 'orders',
      row_count: 8640,
      description: 'Commercial invoices, expansion orders, and regional revenue transactions.',
      columns: [
        {
          name: 'order_id',
          data_type: 'VARCHAR(36)',
          nullable: false,
          is_primary_key: true,
          is_foreign_key: false,
          foreign_key_target: null,
          distinct_count: 8640,
          null_count: 0,
          min_value: 'ORD-10001',
          max_value: 'ORD-18640',
          sample_values: ['ORD-10001', 'ORD-10240'],
        },
        {
          name: 'customer_id',
          data_type: 'VARCHAR(36)',
          nullable: false,
          is_primary_key: false,
          is_foreign_key: true,
          foreign_key_target: 'customers.customer_id',
          distinct_count: 1210,
          null_count: 0,
          min_value: 'CUST-1001',
          max_value: 'CUST-2240',
          sample_values: ['CUST-1001', 'CUST-1042'],
        },
        {
          name: 'order_date',
          data_type: 'DATE',
          nullable: false,
          is_primary_key: false,
          is_foreign_key: false,
          foreign_key_target: null,
          distinct_count: 365,
          null_count: 0,
          min_value: '2025-11-01',
          max_value: '2026-11-01',
          sample_values: ['2026-09-14', '2026-10-02'],
        },
        {
          name: 'total_amount',
          data_type: 'DECIMAL(12,2)',
          nullable: false,
          is_primary_key: false,
          is_foreign_key: false,
          foreign_key_target: null,
          distinct_count: 2450,
          null_count: 0,
          min_value: 190,
          max_value: 84500,
          sample_values: [18400, 6450, 29100],
        },
        {
          name: 'gross_margin_pct',
          data_type: 'DECIMAL(5,2)',
          nullable: false,
          is_primary_key: false,
          is_foreign_key: false,
          foreign_key_target: null,
          distinct_count: 64,
          null_count: 0,
          min_value: 52.4,
          max_value: 88.5,
          sample_values: [78.4, 81.2, 74.6],
        },
      ],
      sample_rows: [
        {
          order_id: 'ORD-10001',
          customer_id: 'CUST-1001',
          order_date: '2026-10-02',
          total_amount: 18400,
          gross_margin_pct: 79.5,
        },
      ],
    },
    {
      table_name: 'order_items',
      row_count: 21450,
      description: 'Line-level SKU breakdown linking orders to product licenses and seat quantities.',
      columns: [
        {
          name: 'item_id',
          data_type: 'VARCHAR(36)',
          nullable: false,
          is_primary_key: true,
          is_foreign_key: false,
          foreign_key_target: null,
          distinct_count: 21450,
          null_count: 0,
          min_value: 'ITM-1',
          max_value: 'ITM-21450',
          sample_values: ['ITM-101', 'ITM-102'],
        },
        {
          name: 'order_id',
          data_type: 'VARCHAR(36)',
          nullable: false,
          is_primary_key: false,
          is_foreign_key: true,
          foreign_key_target: 'orders.order_id',
          distinct_count: 8640,
          null_count: 0,
          min_value: 'ORD-10001',
          max_value: 'ORD-18640',
          sample_values: ['ORD-10001', 'ORD-10002'],
        },
        {
          name: 'product_id',
          data_type: 'VARCHAR(36)',
          nullable: false,
          is_primary_key: false,
          is_foreign_key: true,
          foreign_key_target: 'products.product_id',
          distinct_count: 48,
          null_count: 0,
          min_value: 'PROD-01',
          max_value: 'PROD-48',
          sample_values: ['PROD-01', 'PROD-07', 'PROD-14'],
        },
        {
          name: 'quantity',
          data_type: 'INTEGER',
          nullable: false,
          is_primary_key: false,
          is_foreign_key: false,
          foreign_key_target: null,
          distinct_count: 50,
          null_count: 0,
          min_value: 1,
          max_value: 250,
          sample_values: [10, 25, 100],
        },
        {
          name: 'line_total',
          data_type: 'DECIMAL(12,2)',
          nullable: false,
          is_primary_key: false,
          is_foreign_key: false,
          foreign_key_target: null,
          distinct_count: 1890,
          null_count: 0,
          min_value: 95,
          max_value: 45000,
          sample_values: [9200, 4800, 12500],
        },
      ],
      sample_rows: [],
    },
    {
      table_name: 'products',
      row_count: 48,
      description: 'Product catalog covering Analytics Core, AI Copilot Add-ons, and Data Connectors.',
      columns: [
        {
          name: 'product_id',
          data_type: 'VARCHAR(36)',
          nullable: false,
          is_primary_key: true,
          is_foreign_key: false,
          foreign_key_target: null,
          distinct_count: 48,
          null_count: 0,
          min_value: 'PROD-01',
          max_value: 'PROD-48',
          sample_values: ['PROD-01', 'PROD-02'],
        },
        {
          name: 'product_name',
          data_type: 'VARCHAR(100)',
          nullable: false,
          is_primary_key: false,
          is_foreign_key: false,
          foreign_key_target: null,
          distinct_count: 48,
          null_count: 0,
          min_value: 'AI Query Engine',
          max_value: 'Warehouse Sync Pro',
          sample_values: ['Insight Core Enterprise', 'Semantic Modeler Pro', 'AI Copilot Seats'],
        },
        {
          name: 'category',
          data_type: 'VARCHAR(48)',
          nullable: false,
          is_primary_key: false,
          is_foreign_key: false,
          foreign_key_target: null,
          distinct_count: 4,
          null_count: 0,
          min_value: 'AI Add-On',
          max_value: 'Security & Governance',
          sample_values: ['Core Platform', 'AI Add-On', 'Data Connectors', 'Security & Governance'],
        },
        {
          name: 'unit_price',
          data_type: 'DECIMAL(10,2)',
          nullable: false,
          is_primary_key: false,
          is_foreign_key: false,
          foreign_key_target: null,
          distinct_count: 36,
          null_count: 0,
          min_value: 49,
          max_value: 4500,
          sample_values: [1200, 450, 2400],
        },
      ],
      sample_rows: [],
    },
    {
      table_name: 'support_tickets',
      row_count: 3420,
      description: 'Customer support escalations, resolution SLA metrics, and CSAT ratings.',
      columns: [
        {
          name: 'ticket_id',
          data_type: 'VARCHAR(36)',
          nullable: false,
          is_primary_key: true,
          is_foreign_key: false,
          foreign_key_target: null,
          distinct_count: 3420,
          null_count: 0,
          min_value: 'TCK-1001',
          max_value: 'TCK-4420',
          sample_values: ['TCK-1001', 'TCK-1088'],
        },
        {
          name: 'customer_id',
          data_type: 'VARCHAR(36)',
          nullable: false,
          is_primary_key: false,
          is_foreign_key: true,
          foreign_key_target: 'customers.customer_id',
          distinct_count: 890,
          null_count: 0,
          min_value: 'CUST-1001',
          max_value: 'CUST-2240',
          sample_values: ['CUST-1001', 'CUST-1042'],
        },
        {
          name: 'priority',
          data_type: 'VARCHAR(16)',
          nullable: false,
          is_primary_key: false,
          is_foreign_key: false,
          foreign_key_target: null,
          distinct_count: 4,
          null_count: 0,
          min_value: 'P1-Critical',
          max_value: 'P4-Low',
          sample_values: ['P1-Critical', 'P2-High', 'P3-Normal'],
        },
        {
          name: 'resolution_hours',
          data_type: 'DECIMAL(8,2)',
          nullable: false,
          is_primary_key: false,
          is_foreign_key: false,
          foreign_key_target: null,
          distinct_count: 220,
          null_count: 0,
          min_value: 0.4,
          max_value: 72.0,
          sample_values: [2.4, 4.8, 11.2],
        },
        {
          name: 'csat_score',
          data_type: 'INTEGER',
          nullable: true,
          is_primary_key: false,
          is_foreign_key: false,
          foreign_key_target: null,
          distinct_count: 5,
          null_count: 180,
          min_value: 1,
          max_value: 5,
          sample_values: [5, 4, 5],
        },
      ],
      sample_rows: [],
    },
  ],
};

const SAMPLE_VIRTUAL_RELATIONS: VirtualRelation[] = [
  {
    id: 'rel-sub-cust',
    name: 'fk_subscriptions_customer',
    sourceTable: 'subscriptions',
    sourceColumn: 'customer_id',
    targetTable: 'customers',
    targetColumn: 'customer_id',
    relationType: 'N:1',
    isVirtual: false,
  },
  {
    id: 'rel-ord-cust',
    name: 'fk_orders_customer',
    sourceTable: 'orders',
    sourceColumn: 'customer_id',
    targetTable: 'customers',
    targetColumn: 'customer_id',
    relationType: 'N:1',
    isVirtual: false,
  },
  {
    id: 'rel-item-ord',
    name: 'fk_order_items_order',
    sourceTable: 'order_items',
    sourceColumn: 'order_id',
    targetTable: 'orders',
    targetColumn: 'order_id',
    relationType: 'N:1',
    isVirtual: false,
  },
  {
    id: 'rel-item-prod',
    name: 'fk_order_items_product',
    sourceTable: 'order_items',
    sourceColumn: 'product_id',
    targetTable: 'products',
    targetColumn: 'product_id',
    relationType: 'N:1',
    isVirtual: false,
  },
  {
    id: 'rel-tck-cust',
    name: 'fk_support_tickets_customer',
    sourceTable: 'support_tickets',
    sourceColumn: 'customer_id',
    targetTable: 'customers',
    targetColumn: 'customer_id',
    relationType: 'N:1',
    isVirtual: false,
  },
];

const SAMPLE_WIDGETS: DashboardWidgetSpec[] = [
  {
    id: 'kpi_total_arr',
    title: 'Total Annual Recurring Revenue',
    subtitle: 'Active subscription run-rate across all tiers',
    widget_type: 'kpi',
    chart_type: 'kpi',
    step_id: 'step_1_kpi_summary',
    sql_query: "SELECT ROUND(SUM(mrr) * 12, 2) AS total_arr FROM subscriptions WHERE status = 'active'",
    data_hash: 'sha256:a18c94e0',
    columns: ['total_arr'],
    rows: [{ total_arr: 18420000 }],
    x_field: null,
    y_fields: ['total_arr'],
    kpi_payload: {
      formatted_value: '$18.42M',
      raw_value: 18420000,
      metric_label: 'Annual Recurring Revenue',
      delta_pct: 14.8,
      delta_direction: 'up',
      sparkline: [14.2, 14.9, 15.6, 16.3, 17.1, 17.8, 18.42],
      subtext: '+$2.38M net new ARR YoY',
    },
    insight_summary: 'Enterprise Plus expansion drove 68% of net new ARR in Q3-Q4.',
    anomalies: [],
  },
  {
    id: 'kpi_nrr',
    title: 'Net Revenue Retention (NRR)',
    subtitle: 'Cohort expansion vs downsell & churn',
    widget_type: 'kpi',
    chart_type: 'kpi',
    step_id: 'step_1_kpi_summary',
    sql_query: 'SELECT 116.4 AS nrr_pct FROM subscriptions LIMIT 1',
    data_hash: 'sha256:b29d41f2',
    columns: ['nrr_pct'],
    rows: [{ nrr_pct: 116.4 }],
    x_field: null,
    y_fields: ['nrr_pct'],
    kpi_payload: {
      formatted_value: '116.4%',
      raw_value: 116.4,
      metric_label: 'Net Dollar Retention',
      delta_pct: 3.2,
      delta_direction: 'up',
      sparkline: [111.0, 112.4, 113.1, 114.5, 115.2, 116.4],
      subtext: 'Top decile SaaS benchmark (>115%)',
    },
    insight_summary: 'AI Copilot seat attach increased Enterprise NRR to 124.1%.',
    anomalies: [],
  },
  {
    id: 'kpi_gross_margin',
    title: 'Blended Gross Margin',
    subtitle: 'Weighted margin across platform & add-ons',
    widget_type: 'kpi',
    chart_type: 'kpi',
    step_id: 'step_1_kpi_summary',
    sql_query: 'SELECT ROUND(AVG(gross_margin_pct), 1) AS avg_margin FROM orders',
    data_hash: 'sha256:c30e52a1',
    columns: ['avg_margin'],
    rows: [{ avg_margin: 78.6 }],
    x_field: null,
    y_fields: ['avg_margin'],
    kpi_payload: {
      formatted_value: '78.6%',
      raw_value: 78.6,
      metric_label: 'Gross Profit Margin',
      delta_pct: 1.9,
      delta_direction: 'up',
      sparkline: [75.8, 76.2, 76.9, 77.4, 78.1, 78.6],
      subtext: '+190 bps infrastructure efficiency gain',
    },
    insight_summary: 'Query caching reduced compute COGS by 11% over the last two quarters.',
    anomalies: [],
  },
  {
    id: 'kpi_sla_resolution',
    title: 'Avg Resolution SLA',
    subtitle: 'Mean time to resolution across P1-P3 tickets',
    widget_type: 'kpi',
    chart_type: 'kpi',
    step_id: 'step_1_kpi_summary',
    sql_query: 'SELECT ROUND(AVG(resolution_hours), 1) AS avg_sla_hrs FROM support_tickets',
    data_hash: 'sha256:d41f63b8',
    columns: ['avg_sla_hrs'],
    rows: [{ avg_sla_hrs: 3.8 }],
    x_field: null,
    y_fields: ['avg_sla_hrs'],
    kpi_payload: {
      formatted_value: '3.8 hrs',
      raw_value: 3.8,
      metric_label: 'Mean Resolution Time',
      delta_pct: -18.4,
      delta_direction: 'up',
      sparkline: [5.4, 4.9, 4.6, 4.3, 4.0, 3.8],
      subtext: '98.2% within enterprise SLA target',
    },
    insight_summary: 'Automated triage cut P2 response times by 42 minutes.',
    anomalies: [],
  },
  {
    id: 'chart_revenue_trajectory',
    title: 'Monthly Revenue & Gross Profit Trajectory',
    subtitle: 'Recognized revenue vs blended gross profit ($K) across 12 months',
    widget_type: 'echarts',
    chart_type: 'area_spline',
    step_id: 'step_2_monthly_trend',
    sql_query:
      "SELECT strftime('%Y-%m', order_date) AS month, ROUND(SUM(total_amount)/1000, 1) AS revenue_k, ROUND(SUM(total_amount * gross_margin_pct / 100)/1000, 1) AS gross_profit_k FROM orders GROUP BY 1 ORDER BY 1",
    data_hash: 'sha256:e52a74c9',
    columns: ['month', 'revenue_k', 'gross_profit_k'],
    rows: [
      { month: '2026-01', revenue_k: 1180, gross_profit_k: 912 },
      { month: '2026-02', revenue_k: 1245, gross_profit_k: 968 },
      { month: '2026-03', revenue_k: 1310, gross_profit_k: 1024 },
      { month: '2026-04', revenue_k: 1290, gross_profit_k: 1008 },
      { month: '2026-05', revenue_k: 1395, gross_profit_k: 1094 },
      { month: '2026-06', revenue_k: 1480, gross_profit_k: 1166 },
      { month: '2026-07', revenue_k: 1540, gross_profit_k: 1214 },
      { month: '2026-08', revenue_k: 1615, gross_profit_k: 1275 },
      { month: '2026-09', revenue_k: 1690, gross_profit_k: 1335 },
      { month: '2026-10', revenue_k: 1785, gross_profit_k: 1412 },
    ],
    x_field: 'month',
    y_fields: ['revenue_k', 'gross_profit_k'],
    echarts_option: {
      tooltip: { trigger: 'axis' },
      legend: {
        data: ['revenue_k', 'gross_profit_k'],
        textStyle: { color: '#94a3b8', fontSize: 11 },
        top: 0,
      },
      grid: { left: '3%', right: '3%', bottom: '6%', top: '14%', containLabel: true },
      xAxis: {
        type: 'category',
        data: [
          '2026-01',
          '2026-02',
          '2026-03',
          '2026-04',
          '2026-05',
          '2026-06',
          '2026-07',
          '2026-08',
          '2026-09',
          '2026-10',
        ],
        axisLabel: { color: '#64748b', fontSize: 11 },
        axisLine: { lineStyle: { color: '#1e293b' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#64748b', fontSize: 11, formatter: '${value}k' },
        splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } },
      },
      series: [
        {
          name: 'revenue_k',
          type: 'line',
          smooth: true,
          data: [1180, 1245, 1310, 1290, 1395, 1480, 1540, 1615, 1690, 1785],
          itemStyle: { color: '#6366f1' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(99, 102, 241, 0.32)' },
                { offset: 1, color: 'rgba(99, 102, 241, 0.02)' },
              ],
            },
          },
        },
        {
          name: 'gross_profit_k',
          type: 'line',
          smooth: true,
          data: [912, 968, 1024, 1008, 1094, 1166, 1214, 1275, 1335, 1412],
          itemStyle: { color: '#06b6d4' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(6, 182, 212, 0.25)' },
                { offset: 1, color: 'rgba(6, 182, 212, 0.01)' },
              ],
            },
          },
        },
      ],
    },
    insight_summary: 'Consistent compounding growth (+51.2% from Jan to Oct) with expanding gross profit spread.',
    anomalies: [
      {
        row_index: 9,
        dimension_label: '2026-10',
        metric_name: 'revenue_k',
        value: 1785,
        z_score: 2.18,
        direction: 'spike',
      },
    ],
  },
  {
    id: 'chart_regional_share',
    title: 'ARR Contribution by Operating Region',
    subtitle: 'Click any region bar to cross-filter linked widgets',
    widget_type: 'echarts',
    chart_type: 'grouped_bar',
    step_id: 'step_3_regional_mix',
    sql_query:
      "SELECT c.region AS region, ROUND(SUM(s.mrr) * 12 / 1000, 1) AS arr_k FROM customers c JOIN subscriptions s ON c.customer_id = s.customer_id WHERE s.status = 'active' GROUP BY c.region ORDER BY arr_k DESC",
    data_hash: 'sha256:f63b85d0',
    columns: ['region', 'arr_k'],
    rows: [
      { region: 'North America', arr_k: 9420 },
      { region: 'EMEA', arr_k: 5180 },
      { region: 'APAC', arr_k: 2640 },
      { region: 'LATAM', arr_k: 1180 },
    ],
    x_field: 'region',
    y_fields: ['arr_k'],
    echarts_option: {
      tooltip: { trigger: 'axis' },
      grid: { left: '4%', right: '4%', bottom: '8%', top: '10%', containLabel: true },
      xAxis: {
        type: 'category',
        data: ['North America', 'EMEA', 'APAC', 'LATAM'],
        axisLabel: { color: '#94a3b8', fontSize: 11 },
        axisLine: { lineStyle: { color: '#1e293b' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#64748b', fontSize: 11, formatter: '${value}k' },
        splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } },
      },
      series: [
        {
          name: 'arr_k',
          type: 'bar',
          barWidth: '46%',
          data: [9420, 5180, 2640, 1180],
          itemStyle: {
            color: '#6366f1',
            borderRadius: [6, 6, 0, 0],
          },
        },
      ],
    },
    insight_summary: 'North America accounts for 51.1% of active ARR, while EMEA grew 24% YoY.',
    anomalies: [],
  },
  {
    id: 'table_segment_performance',
    title: 'Segment Economics & Account Health Matrix',
    subtitle: 'Joined aggregation across customers, subscriptions, orders, and support_tickets',
    widget_type: 'table',
    chart_type: 'table',
    step_id: 'step_4_segment_table',
    sql_query:
      'SELECT c.segment, c.region, COUNT(DISTINCT c.customer_id) AS accounts, ROUND(SUM(s.mrr)*12, 0) AS active_arr, ROUND(AVG(c.health_score), 1) AS avg_health, ROUND(AVG(t.resolution_hours), 1) AS sla_hours FROM customers c JOIN subscriptions s ON c.customer_id = s.customer_id LEFT JOIN support_tickets t ON c.customer_id = t.customer_id GROUP BY c.segment, c.region ORDER BY active_arr DESC',
    data_hash: 'sha256:074c96e1',
    columns: ['segment', 'region', 'accounts', 'active_arr', 'avg_health', 'sla_hours'],
    rows: [
      {
        segment: 'Enterprise',
        region: 'North America',
        accounts: 185,
        active_arr: 6420000,
        avg_health: 91.4,
        sla_hours: 2.6,
      },
      {
        segment: 'Enterprise',
        region: 'EMEA',
        accounts: 112,
        active_arr: 3480000,
        avg_health: 88.9,
        sla_hours: 3.1,
      },
      {
        segment: 'Mid-Market',
        region: 'North America',
        accounts: 310,
        active_arr: 2190000,
        avg_health: 84.2,
        sla_hours: 3.9,
      },
      {
        segment: 'Mid-Market',
        region: 'APAC',
        accounts: 164,
        active_arr: 1710000,
        avg_health: 86.0,
        sla_hours: 3.5,
      },
      {
        segment: 'Mid-Market',
        region: 'EMEA',
        accounts: 215,
        active_arr: 1320000,
        avg_health: 82.7,
        sla_hours: 4.2,
      },
      {
        segment: 'SMB',
        region: 'LATAM',
        accounts: 254,
        active_arr: 1180000,
        avg_health: 79.5,
        sla_hours: 4.8,
      },
    ],
    x_field: 'segment',
    y_fields: ['active_arr', 'avg_health'],
    insight_summary: 'Enterprise North America maintains the highest health score (91.4) and fastest SLA (2.6 hrs).',
    anomalies: [],
  },
];

const SAMPLE_LAYOUTS: Record<string, GridCoordinates[]> = {
  lg: [
    { i: 'kpi_total_arr', x: 0, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
    { i: 'kpi_nrr', x: 3, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
    { i: 'kpi_gross_margin', x: 6, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
    { i: 'kpi_sla_resolution', x: 9, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
    { i: 'chart_revenue_trajectory', x: 0, y: 4, w: 7, h: 9, minW: 4, minH: 6 },
    { i: 'chart_regional_share', x: 7, y: 4, w: 5, h: 9, minW: 4, minH: 6 },
    { i: 'table_segment_performance', x: 0, y: 13, w: 12, h: 8, minW: 6, minH: 5 },
  ],
  md: [
    { i: 'kpi_total_arr', x: 0, y: 0, w: 4, h: 4 },
    { i: 'kpi_nrr', x: 4, y: 0, w: 4, h: 4 },
    { i: 'kpi_gross_margin', x: 0, y: 4, w: 4, h: 4 },
    { i: 'kpi_sla_resolution', x: 4, y: 4, w: 4, h: 4 },
    { i: 'chart_revenue_trajectory', x: 0, y: 8, w: 8, h: 9 },
    { i: 'chart_regional_share', x: 0, y: 17, w: 8, h: 8 },
    { i: 'table_segment_performance', x: 0, y: 25, w: 8, h: 8 },
  ],
  sm: [
    { i: 'kpi_total_arr', x: 0, y: 0, w: 4, h: 4 },
    { i: 'kpi_nrr', x: 0, y: 4, w: 4, h: 4 },
    { i: 'kpi_gross_margin', x: 0, y: 8, w: 4, h: 4 },
    { i: 'kpi_sla_resolution', x: 0, y: 12, w: 4, h: 4 },
    { i: 'chart_revenue_trajectory', x: 0, y: 16, w: 4, h: 9 },
    { i: 'chart_regional_share', x: 0, y: 25, w: 4, h: 8 },
    { i: 'table_segment_performance', x: 0, y: 33, w: 4, h: 8 },
  ],
};

const SAMPLE_MANIFEST: PipelineManifest = {
  pipeline_id: 'pipe-sample-saas-commerce',
  title: 'Executive Revenue, Margin & Retention Overview',
  user_query: 'Analyze executive revenue trajectory, profit margins, regional share, and product performance',
  created_at: '2026-11-10T09:15:00.000Z',
  last_replayed_at: '2026-11-12T10:00:00.000Z',
  connector_id: 'default_sqlite_commerce',
  connector_name: 'SaaS & Global Commerce SQLite',
  dialect: 'sqlite',
  schema_fingerprint: 'sha256:9f84c2a10d7e4b6c93a8f12e4b018c7d',
  model_used: 'qwen2.5-coder:7b',
  steps: [
    {
      step_id: 'step_1_kpi_summary',
      step_number: 1,
      title: 'Core SaaS ARR, NRR, Margin & SLA KPI Aggregation',
      kind: 'sql_extraction',
      sql_query:
        "SELECT ROUND(SUM(mrr) * 12, 2) AS total_arr FROM subscriptions WHERE status = 'active'",
      executed_sql:
        "SELECT ROUND(SUM(mrr) * 12, 2) AS total_arr FROM subscriptions WHERE status = 'active'",
      depends_on: [],
      operation: 'Aggregate headline executive KPIs across subscriptions, orders, and support_tickets.',
      row_count: 1,
      columns: ['total_arr', 'nrr_pct', 'avg_margin', 'avg_sla_hrs'],
      output_hash: 'sha256:a18c94e0',
      execution_ms: 14,
      anomalies_detected: [],
      summary_stats: { total_arr: 18420000, nrr_pct: 116.4 },
    },
    {
      step_id: 'step_2_monthly_trend',
      step_number: 2,
      title: 'Monthly Revenue & Gross Margin Time-Series Extraction',
      kind: 'sql_extraction',
      sql_query:
        "SELECT strftime('%Y-%m', order_date) AS month, ROUND(SUM(total_amount)/1000, 1) AS revenue_k, ROUND(SUM(total_amount * gross_margin_pct / 100)/1000, 1) AS gross_profit_k FROM orders GROUP BY 1 ORDER BY 1",
      executed_sql:
        "SELECT strftime('%Y-%m', order_date) AS month, ROUND(SUM(total_amount)/1000, 1) AS revenue_k, ROUND(SUM(total_amount * gross_margin_pct / 100)/1000, 1) AS gross_profit_k FROM orders GROUP BY 1 ORDER BY 1",
      depends_on: ['step_1_kpi_summary'],
      operation: 'Time-series aggregation with Z-score anomaly detection on monthly order volume.',
      row_count: 10,
      columns: ['month', 'revenue_k', 'gross_profit_k'],
      output_hash: 'sha256:e52a74c9',
      execution_ms: 22,
      anomalies_detected: [
        {
          row_index: 9,
          dimension_label: '2026-10',
          metric_name: 'revenue_k',
          value: 1785,
          z_score: 2.18,
          direction: 'spike',
        },
      ],
      summary_stats: { growth_pct: 51.2 },
    },
    {
      step_id: 'step_3_regional_mix',
      step_number: 3,
      title: 'Regional ARR Share & Segment Matrix Join',
      kind: 'statistical_enrichment',
      sql_query:
        "SELECT c.region AS region, ROUND(SUM(s.mrr) * 12 / 1000, 1) AS arr_k FROM customers c JOIN subscriptions s ON c.customer_id = s.customer_id WHERE s.status = 'active' GROUP BY c.region ORDER BY arr_k DESC",
      executed_sql:
        "SELECT c.region AS region, ROUND(SUM(s.mrr) * 12 / 1000, 1) AS arr_k FROM customers c JOIN subscriptions s ON c.customer_id = s.customer_id WHERE s.status = 'active' GROUP BY c.region ORDER BY arr_k DESC",
      depends_on: ['step_1_kpi_summary'],
      operation: 'Multi-table relational join across customers, subscriptions, and support_tickets.',
      row_count: 6,
      columns: ['region', 'arr_k'],
      output_hash: 'sha256:f63b85d0',
      execution_ms: 19,
      anomalies_detected: [],
      summary_stats: { top_region: 'North America' },
    },
  ],
  widgets: SAMPLE_WIDGETS,
  layouts: SAMPLE_LAYOUTS,
  executive_summary:
    'Active ARR reached $18.42M (+14.8% YoY) with 116.4% Net Revenue Retention and 78.6% blended gross margin. North America and EMEA Enterprise accounts drive 74% of net expansion while support SLA velocity improved by 18.4%.',
  key_insights: [
    'Enterprise Plus tier accounts in North America generated $6.42M ARR with an average health score of 91.4.',
    'October 2026 recorded a statistically significant revenue spike ($1.785M, z = +2.18) driven by Q4 multi-year renewals.',
    'Blended gross margin improved +190 bps to 78.6% following AI query caching optimizations.',
    'Mean ticket resolution time dropped to 3.8 hours across all segments.',
  ],
  suggested_followups: [
    'Analyze SaaS churn reasons, ARR exposure, customer health score, and retention by segment',
    'Evaluate marketing attribution funnel, campaign spend vs pipeline value, and regional conversions',
    'Inspect customer support ticket volume, SLA breaches, resolution velocity, and CSAT scores',
  ],
  reproducibility_verified: true,
  data_drifted: false,
};

const SAMPLE_CONVERSATION: ConversationMessage[] = [
  {
    id: 'msg-sample-user-1',
    role: 'user',
    content: 'Analyze executive revenue trajectory, profit margins, regional share, and product performance',
    timestamp: '2026-11-10T09:14:52.000Z',
    modelUsed: 'qwen2.5-coder:7b',
  },
  {
    id: 'msg-sample-assistant-1',
    role: 'assistant',
    content:
      'I orchestrated the 6-agent LangGraph BI pipeline against **SaaS & Global Commerce SQLite** (`6 tables`, `5 foreign-key relations`).\n\n### What the Multi-Agent Pipeline Built\n1. **Schema & Semantic Graph**: Mapped primary/foreign keys connecting `customers`, `subscriptions`, `orders`, `order_items`, `products`, and `support_tickets`.\n2. **SQL Extraction & Statistical Enrichment**: Executed 4 deterministic SQL steps computing `$18.42M` active ARR, `116.4%` NRR, `78.6%` gross margin, and detected a `+2.18σ` revenue expansion spike in `2026-10`.\n3. **Executive Layout Synthesis**: Arranged 4 headline KPI scorecards, a dual-series spline trajectory chart, a regional cross-filtering bar chart, and a multi-table segment health matrix.',
    timestamp: '2026-11-10T09:15:00.000Z',
    modelUsed: 'qwen2.5-coder:7b',
    thoughtSummary:
      'Profiled 6 SQLite tables → Planned 4 analytical SQL queries → Verified SHA-256 lineage hashes → Assembled 12-column responsive Executive grid.',
    agentTraces: [
      {
        agent: 'SchemaProfilerAgent',
        status: 'completed',
        title: 'Introspected 6 relational tables & 5 FK constraints',
        detail: 'Fingerprinted schema sha256:9f84c2a1 and verified join paths across customers, subscriptions, and orders.',
        duration_ms: 48,
      },
      {
        agent: 'BIPlannerAgent',
        status: 'completed',
        title: 'Synthesized 4-part executive analytical plan',
        detail: 'Selected KPI summary, monthly revenue/margin spline, regional ARR breakdown, and segment health matrix.',
        duration_ms: 310,
      },
      {
        agent: 'SQLDataAgent',
        status: 'completed',
        title: 'Executed 4 read-only SQLite queries with zero errors',
        detail: 'Extracted 36,278 underlying rows into 4 aggregated result sets.',
        duration_ms: 64,
      },
      {
        agent: 'PipelineBuilderAgent',
        status: 'completed',
        title: 'Computed Z-score anomalies & SHA-256 lineage DAG',
        detail: 'Flagged 2026-10 revenue spike (z = +2.18) and locked reproducible step hashes.',
        duration_ms: 29,
      },
      {
        agent: 'VizLayoutAgent',
        status: 'completed',
        title: 'Bound ECharts specs & 12-col responsive coordinates',
        detail: 'Configured Executive preset with 4 KPI cards (w=3), 2 charts (w=7, w=5), and 1 table (w=12).',
        duration_ms: 18,
      },
      {
        agent: 'InsightNarratorAgent',
        status: 'completed',
        title: 'Synthesized executive narrative & follow-up hypotheses',
        detail: 'Distilled 4 board-level insights and 3 drill-down prompts.',
        duration_ms: 195,
      },
    ],
    sqlQueries: [
      {
        title: 'Active ARR & Subscription Run-Rate',
        sql: "SELECT ROUND(SUM(mrr) * 12, 2) AS total_arr FROM subscriptions WHERE status = 'active'",
        rowCount: 1,
        executionMs: 14,
      },
      {
        title: 'Monthly Revenue & Gross Profit Trajectory',
        sql: "SELECT strftime('%Y-%m', order_date) AS month, ROUND(SUM(total_amount)/1000, 1) AS revenue_k, ROUND(SUM(total_amount * gross_margin_pct / 100)/1000, 1) AS gross_profit_k FROM orders GROUP BY 1 ORDER BY 1",
        rowCount: 10,
        executionMs: 22,
      },
      {
        title: 'Regional ARR Contribution',
        sql: "SELECT c.region AS region, ROUND(SUM(s.mrr) * 12 / 1000, 1) AS arr_k FROM customers c JOIN subscriptions s ON c.customer_id = s.customer_id WHERE s.status = 'active' GROUP BY c.region ORDER BY arr_k DESC",
        rowCount: 4,
        executionMs: 19,
      },
    ],
    keyInsights: SAMPLE_MANIFEST.key_insights,
    suggestedFollowups: SAMPLE_MANIFEST.suggested_followups,
  },
];

export function createSampleProject(): InsightForgeProject {
  return {
    id: 'sample-saas-commerce',
    name: 'SaaS & Global Commerce BI',
    description:
      'End-to-end semantic model across 6 relational tables (Subscriptions, Orders, Customers, Products, Support SLA) with reproducible LangGraph executive dashboard.',
    createdAt: '2026-11-10T09:00:00.000Z',
    updatedAt: '2026-11-12T10:15:00.000Z',
    isSample: true,
    activeConnectorId: 'default_sqlite_commerce',
    dataSources: [
      {
        id: 'ds-default-sqlite',
        name: 'SaaS & Global Commerce SQLite',
        dialect: 'sqlite',
        connectorId: 'default_sqlite_commerce',
        database: 'saas_commerce.db',
        selectedTables: [
          'customers',
          'subscriptions',
          'orders',
          'order_items',
          'products',
          'support_tickets',
        ],
        addedAt: '2026-11-10T09:00:00.000Z',
      },
    ],
    embeddedCsvTables: [],
    schemaCatalog: SAMPLE_SCHEMA_CATALOG,
    virtualRelations: SAMPLE_VIRTUAL_RELATIONS,
    pages: [
      {
        id: 'page-exec-1',
        title: 'Executive Overview',
        layoutPreset: 'executive',
        widgets: SAMPLE_WIDGETS,
        layouts: SAMPLE_LAYOUTS,
        crossFilter: null,
        widgetScopes: {},
      },
    ],
    activePageId: 'page-exec-1',
    conversationHistory: SAMPLE_CONVERSATION,
    manifest: SAMPLE_MANIFEST,
  };
}

function loadInitialProjects(): InsightForgeProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = [createSampleProject()];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Sanitize: clean up any blank project that has no data source and should not have leaked widgets
      const cleaned = parsed.map((p: InsightForgeProject) => {
        const isBlankNoData =
          !p.isSample &&
          (!p.dataSources || p.dataSources.length === 0) &&
          (!p.embeddedCsvTables || p.embeddedCsvTables.length === 0);
        if (isBlankNoData) {
          return {
            ...p,
            manifest: null,
            pages: (p.pages || []).map((pg) => ({
              ...pg,
              widgets: [],
              layouts: {},
              crossFilter: null,
            })),
          };
        }
        return p;
      });

      const hasSample = cleaned.some((p: InsightForgeProject) => p.id === 'sample-saas-commerce');
      if (!hasSample) {
        const withSample = [createSampleProject(), ...cleaned];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(withSample));
        return withSample;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
      return cleaned;
    }
  } catch {
    // fallback to default sample project
  }
  const fallback = [createSampleProject()];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fallback));
  } catch {
    // ignore storage quota errors
  }
  return fallback;
}

function persistProjects(projects: InsightForgeProject[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch {
    // ignore storage quota errors
  }
}

export interface ProjectStore {
  projects: InsightForgeProject[];
  activeProjectId: string | null;
  selectedWidgetId: string | null;
  isDataSourceModalOpen: boolean;
  isERDiagramModalOpen: boolean;

  getActiveProject: () => InsightForgeProject | null;
  createBlankProject: (name?: string) => InsightForgeProject;
  openProject: (id: string) => void;
  updateProjectMeta: (
    id: string,
    patch: Partial<Pick<InsightForgeProject, 'name' | 'description'>>
  ) => void;
  deleteProject: (id: string) => void;
  duplicateProject: (id: string) => InsightForgeProject | null;
  importIFPFProject: (file: File) => Promise<InsightForgeProject>;
  exportIFPFProject: (id: string) => Promise<void>;

  addDataSourceToProject: (
    projectId: string,
    source: DataSourceConfig,
    catalog?: SchemaCatalog | null
  ) => void;
  addEmbeddedCsvToProject: (
    projectId: string,
    csvTable: EmbeddedCsvTable,
    tableProfile?: TableProfile
  ) => void;
  setProjectSchemaCatalog: (projectId: string, catalog: SchemaCatalog) => void;
  addVirtualRelation: (projectId: string, rel: Omit<VirtualRelation, 'id'>) => void;
  removeVirtualRelation: (projectId: string, relId: string) => void;
  appendConversationMessage: (projectId: string, msg: ConversationMessage) => void;
  syncDashboardToProject: (
    projectId: string,
    payload: {
      manifest?: PipelineManifest | null;
      widgets?: DashboardWidgetSpec[];
      layouts?: Record<string, GridCoordinates[]>;
      layoutPreset?: 'executive' | 'bento' | 'compact';
      crossFilter?: CrossFilterState | null;
    }
  ) => void;
  updateWidgetScope: (
    projectId: string,
    widgetId: string,
    scope: Partial<WidgetScopeState>
  ) => void;
  addDashboardPage: (projectId: string, title?: string) => void;
  setActiveDashboardPage: (projectId: string, pageId: string) => void;
  setSelectedWidgetId: (widgetId: string | null) => void;
  setDataSourceModalOpen: (open: boolean) => void;
  setERDiagramModalOpen: (open: boolean) => void;
}

const initialProjects = loadInitialProjects();

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: initialProjects,
  activeProjectId: initialProjects[0]?.id ?? 'sample-saas-commerce',
  selectedWidgetId: null,
  isDataSourceModalOpen: false,
  isERDiagramModalOpen: false,

  getActiveProject: () => {
    const { projects, activeProjectId } = get();
    if (!activeProjectId) return projects[0] ?? null;
    return projects.find((p) => p.id === activeProjectId) ?? projects[0] ?? null;
  },

  createBlankProject: (name?: string) => {
    const now = new Date().toISOString();
    const id = generateUUID();
    const initialPage: DashboardPageSpec = {
      id: 'page-1',
      title: 'Page 1',
      layoutPreset: 'executive',
      widgets: [],
      layouts: {},
      crossFilter: null,
      widgetScopes: {},
    };

    const blankProject: InsightForgeProject = {
      id,
      name: name?.trim() || 'Untitled Project',
      description: 'Blank semantic BI workspace — connect a SQL database or import CSV tables to begin.',
      createdAt: now,
      updatedAt: now,
      isSample: false,
      activeConnectorId: '',
      dataSources: [],
      embeddedCsvTables: [],
      schemaCatalog: null,
      virtualRelations: [],
      pages: [initialPage],
      activePageId: initialPage.id,
      conversationHistory: [],
      manifest: null,
    };

    set((state) => {
      const next = [blankProject, ...state.projects];
      persistProjects(next);
      return {
        projects: next,
        activeProjectId: blankProject.id,
        selectedWidgetId: null,
      };
    });

    return blankProject;
  },

  openProject: (id: string) => {
    set((state) => {
      const exists = state.projects.some((p) => p.id === id);
      return {
        activeProjectId: exists ? id : state.projects[0]?.id ?? null,
        selectedWidgetId: null,
      };
    });
  },

  updateProjectMeta: (id, patch) => {
    const now = new Date().toISOString();
    set((state) => {
      const next = state.projects.map((p) =>
        p.id === id
          ? {
              ...p,
              ...patch,
              updatedAt: now,
            }
          : p
      );
      persistProjects(next);
      return { projects: next };
    });
  },

  deleteProject: (id: string) => {
    set((state) => {
      let next = state.projects.filter((p) => p.id !== id);
      if (next.length === 0) {
        next = [createSampleProject()];
      }
      persistProjects(next);
      const nextActive =
        state.activeProjectId === id ? next[0]?.id ?? null : state.activeProjectId;
      return {
        projects: next,
        activeProjectId: nextActive,
      };
    });
  },

  duplicateProject: (id: string) => {
    const source = get().projects.find((p) => p.id === id);
    if (!source) return null;
    const now = new Date().toISOString();
    const copy: InsightForgeProject = JSON.parse(JSON.stringify(source));
    copy.id = generateUUID();
    copy.name = `${source.name} (Copy)`;
    copy.isSample = false;
    copy.createdAt = now;
    copy.updatedAt = now;

    set((state) => {
      const next = [copy, ...state.projects];
      persistProjects(next);
      return { projects: next };
    });
    return copy;
  },

  importIFPFProject: async (file: File) => {
    const imported = await importProjectFromIFPF(file);
    set((state) => {
      const next = [imported, ...state.projects];
      persistProjects(next);
      return {
        projects: next,
        activeProjectId: imported.id,
        selectedWidgetId: null,
      };
    });
    return imported;
  },

  exportIFPFProject: async (id: string) => {
    const target = get().projects.find((p) => p.id === id) || get().getActiveProject();
    if (!target) return;
    await exportProjectToIFPF(target);
  },

  addDataSourceToProject: (projectId, source, catalog) => {
    const now = new Date().toISOString();
    set((state) => {
      const next = state.projects.map((p) => {
        if (p.id !== projectId) return p;
        const filteredSources = p.dataSources.filter((ds) => ds.id !== source.id);
        let mergedCatalog = p.schemaCatalog;

        if (catalog) {
          const selectedSet =
            source.selectedTables.length > 0 ? new Set(source.selectedTables) : null;
          const incomingTables = selectedSet
            ? catalog.tables.filter((t) => selectedSet.has(t.table_name))
            : catalog.tables;

          if (!mergedCatalog) {
            mergedCatalog = {
              ...catalog,
              tables: incomingTables,
            };
          } else {
            const existingMap = new Map(mergedCatalog.tables.map((t) => [t.table_name, t]));
            for (const tbl of incomingTables) {
              existingMap.set(tbl.table_name, tbl);
            }
            mergedCatalog = {
              ...catalog,
              tables: Array.from(existingMap.values()),
            };
          }
        }

        // Auto-extract physical FK relations from mergedCatalog if not already present
        const existingRelKeys = new Set(
          p.virtualRelations.map(
            (r) => `${r.sourceTable}.${r.sourceColumn}->${r.targetTable}.${r.targetColumn}`
          )
        );
        const newRelations: VirtualRelation[] = [...p.virtualRelations];
        if (mergedCatalog) {
          for (const tbl of mergedCatalog.tables) {
            for (const col of tbl.columns) {
              if (col.is_foreign_key && col.foreign_key_target) {
                const [targetTable, targetColumn] = col.foreign_key_target.split('.');
                if (targetTable && targetColumn) {
                  const key = `${tbl.table_name}.${col.name}->${targetTable}.${targetColumn}`;
                  if (!existingRelKeys.has(key)) {
                    existingRelKeys.add(key);
                    newRelations.push({
                      id: `rel-${generateUUID().slice(0, 8)}`,
                      name: `fk_${tbl.table_name}_${col.name}`,
                      sourceTable: tbl.table_name,
                      sourceColumn: col.name,
                      targetTable,
                      targetColumn,
                      relationType: 'N:1',
                      isVirtual: false,
                    });
                  }
                }
              }
            }
          }
        }

        return {
          ...p,
          activeConnectorId: source.dialect !== 'csv' ? source.connectorId : p.activeConnectorId || source.connectorId,
          dataSources: [...filteredSources, source],
          schemaCatalog: mergedCatalog,
          virtualRelations: newRelations,
          updatedAt: now,
        };
      });
      persistProjects(next);
      return { projects: next };
    });
  },

  addEmbeddedCsvToProject: (projectId, csvTable, tableProfile) => {
    const now = new Date().toISOString();
    set((state) => {
      const next = state.projects.map((p) => {
        if (p.id !== projectId) return p;

        const existingCsv = p.embeddedCsvTables.filter(
          (c) => c.tableName !== csvTable.tableName
        );
        const csvSourceConfig: DataSourceConfig = {
          id: `ds-csv-${csvTable.tableName}`,
          name: `${csvTable.fileName} (CSV)`,
          dialect: 'csv',
          connectorId: p.activeConnectorId || 'default_sqlite_commerce',
          database: csvTable.fileName,
          selectedTables: [csvTable.tableName],
          addedAt: now,
        };
        const existingSources = p.dataSources.filter((d) => d.id !== csvSourceConfig.id);

        const synthesizedProfile: TableProfile =
          tableProfile ?? {
            table_name: csvTable.tableName,
            row_count: csvTable.rowCount,
            description: `Imported CSV table from ${csvTable.fileName}`,
            columns: csvTable.columns.map((colName, idx) => {
              const sampleVals = csvTable.rows
                .slice(0, 5)
                .map((r) => r[colName])
                .filter((v) => v !== undefined && v !== null);
              const firstVal = sampleVals[0];
              const inferredType =
                typeof firstVal === 'number'
                  ? Number.isInteger(firstVal)
                    ? 'INTEGER'
                    : 'DECIMAL'
                  : 'VARCHAR';
              const isPk =
                idx === 0 &&
                (colName.toLowerCase().endsWith('_id') || colName.toLowerCase() === 'id');
              return {
                name: colName,
                data_type: inferredType,
                nullable: true,
                is_primary_key: isPk,
                is_foreign_key: false,
                foreign_key_target: null,
                distinct_count: null,
                null_count: 0,
                min_value: sampleVals[0] ?? null,
                max_value: sampleVals[sampleVals.length - 1] ?? null,
                sample_values: sampleVals.slice(0, 3),
              };
            }),
            sample_rows: csvTable.rows.slice(0, 5),
          };

        const currentCatalog: SchemaCatalog = p.schemaCatalog ?? {
          connector_id: p.activeConnectorId || 'default_sqlite_commerce',
          connector_name: 'Hybrid SQL + CSV Workspace',
          dialect: 'sqlite',
          database_display: csvTable.fileName,
          schema_fingerprint: `sha256:csv-${Date.now()}`,
          tables: [],
        };

        const otherTables = currentCatalog.tables.filter(
          (t) => t.table_name !== synthesizedProfile.table_name
        );

        return {
          ...p,
          activeConnectorId: p.activeConnectorId || 'default_sqlite_commerce',
          embeddedCsvTables: [...existingCsv, csvTable],
          dataSources: [...existingSources, csvSourceConfig],
          schemaCatalog: {
            ...currentCatalog,
            tables: [...otherTables, synthesizedProfile],
          },
          updatedAt: now,
        };
      });
      persistProjects(next);
      return { projects: next };
    });
  },

  setProjectSchemaCatalog: (projectId, catalog) => {
    const now = new Date().toISOString();
    set((state) => {
      const next = state.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              schemaCatalog: catalog,
              updatedAt: now,
            }
          : p
      );
      persistProjects(next);
      return { projects: next };
    });
  },

  addVirtualRelation: (projectId, rel) => {
    const now = new Date().toISOString();
    const newRelation: VirtualRelation = {
      ...rel,
      id: `vrel-${generateUUID().slice(0, 8)}`,
    };
    set((state) => {
      const next = state.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              virtualRelations: [...p.virtualRelations, newRelation],
              updatedAt: now,
            }
          : p
      );
      persistProjects(next);
      return { projects: next };
    });
  },

  removeVirtualRelation: (projectId, relId) => {
    const now = new Date().toISOString();
    set((state) => {
      const next = state.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              virtualRelations: p.virtualRelations.filter((r) => r.id !== relId),
              updatedAt: now,
            }
          : p
      );
      persistProjects(next);
      return { projects: next };
    });
  },

  appendConversationMessage: (projectId, msg) => {
    const now = new Date().toISOString();
    set((state) => {
      const next = state.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              conversationHistory: [...p.conversationHistory, msg],
              updatedAt: now,
            }
          : p
      );
      persistProjects(next);
      return { projects: next };
    });
  },

  syncDashboardToProject: (projectId, payload) => {
    const now = new Date().toISOString();
    set((state) => {
      const next = state.projects.map((p) => {
        if (p.id !== projectId) return p;
        const activePageId = p.activePageId || p.pages[0]?.id || 'page-1';
        const isBlankNoData =
          !p.isSample &&
          (!p.dataSources || p.dataSources.length === 0) &&
          (!p.embeddedCsvTables || p.embeddedCsvTables.length === 0);

        const updatedPages = p.pages.map((page) => {
          if (page.id !== activePageId) return page;

          let resolvedWidgets = page.widgets;
          if (payload.widgets !== undefined) {
            resolvedWidgets = payload.widgets;
          } else if (payload.manifest?.widgets !== undefined && !isBlankNoData) {
            resolvedWidgets = payload.manifest.widgets;
          }
          if (isBlankNoData && (!payload.widgets || payload.widgets.length === 0)) {
            resolvedWidgets = [];
          }

          let resolvedLayouts = page.layouts;
          if (payload.layouts !== undefined) {
            resolvedLayouts = payload.layouts;
          } else if (payload.manifest?.layouts !== undefined && !isBlankNoData) {
            resolvedLayouts = payload.manifest.layouts;
          }
          if (isBlankNoData && resolvedWidgets.length === 0) {
            resolvedLayouts = {};
          }

          return {
            ...page,
            widgets: resolvedWidgets,
            layouts: resolvedLayouts,
            layoutPreset: payload.layoutPreset ?? page.layoutPreset,
            crossFilter:
              payload.crossFilter !== undefined ? payload.crossFilter : page.crossFilter,
          };
        });

        return {
          ...p,
          manifest: isBlankNoData ? null : payload.manifest !== undefined ? payload.manifest : p.manifest,
          pages: updatedPages,
          updatedAt: now,
        };
      });
      persistProjects(next);
      return { projects: next };
    });
  },

  updateWidgetScope: (projectId, widgetId, scope) => {
    const now = new Date().toISOString();
    set((state) => {
      const next = state.projects.map((p) => {
        if (p.id !== projectId) return p;
        const activePageId = p.activePageId || p.pages[0]?.id;
        const pages = p.pages.map((page) => {
          if (page.id !== activePageId) return page;
          const prevScope = page.widgetScopes[widgetId] || {};
          return {
            ...page,
            widgetScopes: {
              ...page.widgetScopes,
              [widgetId]: { ...prevScope, ...scope },
            },
          };
        });
        return {
          ...p,
          pages,
          updatedAt: now,
        };
      });
      persistProjects(next);
      return { projects: next };
    });
  },

  addDashboardPage: (projectId, title) => {
    const now = new Date().toISOString();
    set((state) => {
      const next = state.projects.map((p) => {
        if (p.id !== projectId) return p;
        const pageIndex = p.pages.length + 1;
        const newPage: DashboardPageSpec = {
          id: `page-${Date.now().toString(36)}`,
          title: title?.trim() || `Page ${pageIndex}`,
          layoutPreset: 'executive',
          widgets: [],
          layouts: {},
          crossFilter: null,
          widgetScopes: {},
        };
        return {
          ...p,
          pages: [...p.pages, newPage],
          activePageId: newPage.id,
          updatedAt: now,
        };
      });
      persistProjects(next);
      return { projects: next, selectedWidgetId: null };
    });
  },

  setActiveDashboardPage: (projectId, pageId) => {
    set((state) => {
      const next = state.projects.map((p) =>
        p.id === projectId && p.pages.some((pg) => pg.id === pageId)
          ? { ...p, activePageId: pageId }
          : p
      );
      persistProjects(next);
      return { projects: next, selectedWidgetId: null };
    });
  },

  setSelectedWidgetId: (widgetId) => set({ selectedWidgetId: widgetId }),
  setDataSourceModalOpen: (open) => set({ isDataSourceModalOpen: open }),
  setERDiagramModalOpen: (open) => set({ isERDiagramModalOpen: open }),
}));
