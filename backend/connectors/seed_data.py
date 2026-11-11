from __future__ import annotations

import random
import sqlite3
from datetime import date, timedelta
from pathlib import Path

TABLE_DESCRIPTIONS: dict[str, str] = {
    "customers": "B2B customer accounts with segment (Enterprise/Mid-Market/SMB), industry, region, acquisition channel, and health score.",
    "products": "Software & data platform product catalog with category, pricing tier, unit price, and gross margin.",
    "subscriptions": "Recurring SaaS subscriptions tracking MRR, ARR, seats, status (Active/Expanded/Churned), and churn reasons.",
    "orders": "Transactional revenue orders with order_date, order_month, region, gross_revenue, discount_usd, net_revenue, and profit_usd.",
    "marketing_campaigns": "Monthly marketing attribution and spend across channels with impressions, clicks, leads, conversions, and pipeline value.",
    "support_tickets": "Customer support tickets tracking priority, category, resolution hours, CSAT score (1-5), and SLA breaches.",
}


def ensure_sample_sqlite_db(db_path: Path) -> Path:
    """Creates and populates the default InsightForge Enterprise BI SQLite database if it doesn't exist."""
    db_path.parent.mkdir(parents=True, exist_ok=True)
    if db_path.exists() and db_path.stat().st_size > 32768:
        return db_path

    rng = random.Random(20261110)
    conn = sqlite3.connect(str(db_path))
    cur = conn.cursor()

    cur.executescript(
        """
        PRAGMA foreign_keys = ON;

        DROP TABLE IF EXISTS support_tickets;
        DROP TABLE IF EXISTS marketing_campaigns;
        DROP TABLE IF EXISTS orders;
        DROP TABLE IF EXISTS subscriptions;
        DROP TABLE IF EXISTS products;
        DROP TABLE IF EXISTS customers;

        CREATE TABLE customers (
            customer_id INTEGER PRIMARY KEY,
            company_name TEXT NOT NULL,
            segment TEXT NOT NULL,
            industry TEXT NOT NULL,
            region TEXT NOT NULL,
            country TEXT NOT NULL,
            acquisition_channel TEXT NOT NULL,
            signup_date TEXT NOT NULL,
            account_health_score INTEGER NOT NULL
        );

        CREATE TABLE products (
            product_id INTEGER PRIMARY KEY,
            product_name TEXT NOT NULL,
            category TEXT NOT NULL,
            tier TEXT NOT NULL,
            unit_price_usd REAL NOT NULL,
            gross_margin_pct REAL NOT NULL
        );

        CREATE TABLE subscriptions (
            subscription_id INTEGER PRIMARY KEY,
            customer_id INTEGER NOT NULL REFERENCES customers(customer_id),
            product_id INTEGER NOT NULL REFERENCES products(product_id),
            plan_tier TEXT NOT NULL,
            billing_cycle TEXT NOT NULL,
            status TEXT NOT NULL,
            mrr_usd REAL NOT NULL,
            arr_usd REAL NOT NULL,
            seats INTEGER NOT NULL,
            start_date TEXT NOT NULL,
            churn_date TEXT,
            churn_reason TEXT
        );

        CREATE TABLE orders (
            order_id INTEGER PRIMARY KEY,
            customer_id INTEGER NOT NULL REFERENCES customers(customer_id),
            product_id INTEGER NOT NULL REFERENCES products(product_id),
            order_date TEXT NOT NULL,
            order_month TEXT NOT NULL,
            region TEXT NOT NULL,
            segment TEXT NOT NULL,
            channel TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            gross_revenue REAL NOT NULL,
            discount_usd REAL NOT NULL,
            net_revenue REAL NOT NULL,
            profit_usd REAL NOT NULL,
            fulfillment_hours REAL NOT NULL
        );

        CREATE TABLE marketing_campaigns (
            campaign_id INTEGER PRIMARY KEY,
            campaign_name TEXT NOT NULL,
            channel TEXT NOT NULL,
            region TEXT NOT NULL,
            campaign_month TEXT NOT NULL,
            spend_usd REAL NOT NULL,
            impressions INTEGER NOT NULL,
            clicks INTEGER NOT NULL,
            leads_generated INTEGER NOT NULL,
            conversions INTEGER NOT NULL,
            pipeline_value_usd REAL NOT NULL
        );

        CREATE TABLE support_tickets (
            ticket_id INTEGER PRIMARY KEY,
            customer_id INTEGER NOT NULL REFERENCES customers(customer_id),
            created_date TEXT NOT NULL,
            created_month TEXT NOT NULL,
            priority TEXT NOT NULL,
            category TEXT NOT NULL,
            resolution_hours REAL NOT NULL,
            csat_score INTEGER NOT NULL,
            sla_breached INTEGER NOT NULL
        );
        """
    )

    # 1. Seed Products
    products_data = [
        (1, "InsightForge Core BI", "AI Analytics Suite", "Growth", 450.0, 0.84),
        (2, "InsightForge Enterprise AI", "AI Analytics Suite", "Enterprise", 1850.0, 0.88),
        (3, "HyperStream ETL Connectors", "Real-Time ETL", "Pro", 680.0, 0.79),
        (4, "Lakehouse Query Accelerator", "Cloud Data Warehouse", "Enterprise", 2400.0, 0.76),
        (5, "DataShield Governance Guard", "Governance & Security", "Enterprise", 1200.0, 0.86),
        (6, "EmbedKit React SDK", "Embedded BI", "Growth", 890.0, 0.89),
        (7, "Pulse Anomaly Monitor", "AI Analytics Suite", "Pro", 590.0, 0.85),
        (8, "CloudSync CDC Pipeline", "Real-Time ETL", "Starter", 290.0, 0.74),
    ]
    cur.executemany(
        "INSERT INTO products VALUES (?, ?, ?, ?, ?, ?)",
        products_data,
    )

    # 2. Seed Customers (320 accounts)
    segments = ["Enterprise", "Mid-Market", "SMB", "Startup"]
    segment_weights = [0.22, 0.35, 0.28, 0.15]
    industries = ["FinTech", "Healthcare", "E-Commerce", "SaaS", "Manufacturing", "Logistics", "Media"]
    regions_countries = {
        "North America": ["United States", "Canada"],
        "Europe": ["United Kingdom", "Germany", "France", "Netherlands", "Sweden"],
        "APAC": ["Singapore", "Japan", "Australia", "India"],
        "LATAM": ["Brazil", "Mexico", "Colombia"],
    }
    region_names = list(regions_countries.keys())
    region_weights = [0.44, 0.28, 0.19, 0.09]
    channels = ["Product-Led", "Organic Search", "LinkedIn Ads", "Partner Referral", "Paid Search", "Outbound Sales"]

    start_epoch = date(2025, 1, 1)
    customers_rows = []
    customer_meta = {}

    for cid in range(1, 321):
        seg = rng.choices(segments, weights=segment_weights, k=1)[0]
        reg = rng.choices(region_names, weights=region_weights, k=1)[0]
        country = rng.choice(regions_countries[reg])
        ind = rng.choice(industries)
        chan = rng.choice(channels)
        signup_offset = rng.randint(0, 620)
        s_date = start_epoch + timedelta(days=signup_offset)
        base_health = {"Enterprise": 84, "Mid-Market": 78, "SMB": 68, "Startup": 64}[seg]
        health = max(25, min(99, int(rng.gauss(base_health, 12))))
        comp_name = f"{ind[:4]}Core {country[:3]} #{cid:03d}"
        customers_rows.append((cid, comp_name, seg, ind, reg, country, chan, s_date.isoformat(), health))
        customer_meta[cid] = {
            "segment": seg,
            "region": reg,
            "channel": chan,
            "signup_date": s_date,
            "health": health,
        }

    cur.executemany(
        "INSERT INTO customers VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        customers_rows,
    )

    # 3. Seed Subscriptions (480 subscriptions)
    churn_reasons = ["Budget Consolidation", "Missing Connector", "Switched to Competitor", "Low Team Adoption", "Company Acquired"]
    sub_rows = []
    sub_id = 1
    for cid in range(1, 321):
        meta = customer_meta[cid]
        num_subs = 2 if meta["segment"] in ("Enterprise", "Mid-Market") and rng.random() < 0.5 else 1
        chosen_prods = rng.sample(products_data, k=num_subs)
        for prod in chosen_prods:
            pid, _, _, p_tier, u_price, _ = prod
            seat_mult = {"Enterprise": rng.randint(25, 120), "Mid-Market": rng.randint(10, 35), "SMB": rng.randint(3, 12), "Startup": rng.randint(2, 8)}[meta["segment"]]
            mrr = round(u_price * (1.0 + (seat_mult * 0.06)), 2)
            arr = round(mrr * 12.0, 2)
            cycle = "Annual" if meta["segment"] in ("Enterprise", "Mid-Market") or rng.random() < 0.55 else "Monthly"

            # Determine status
            churn_prob = {"Enterprise": 0.06, "Mid-Market": 0.11, "SMB": 0.22, "Startup": 0.26}[meta["segment"]]
            roll = rng.random()
            if roll < churn_prob:
                status = "Churned"
                c_date = (meta["signup_date"] + timedelta(days=rng.randint(30, 180))).isoformat()
                c_reason = rng.choice(churn_reasons)
            elif roll < churn_prob + 0.24:
                status = "Expanded"
                c_date = None
                c_reason = None
                mrr = round(mrr * 1.35, 2)
                arr = round(mrr * 12.0, 2)
            else:
                status = "Active"
                c_date = None
                c_reason = None

            sub_rows.append((
                sub_id,
                cid,
                pid,
                p_tier,
                cycle,
                status,
                mrr,
                arr,
                seat_mult,
                meta["signup_date"].isoformat(),
                c_date,
                c_reason,
            ))
            sub_id += 1

    cur.executemany(
        "INSERT INTO subscriptions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        sub_rows,
    )

    # 4. Seed Orders across 22 months (2025-01 through 2026-10) -> ~2,400 orders
    order_rows = []
    oid = 1
    months: list[date] = []
    for y in (2025, 2026):
        max_m = 12 if y == 2025 else 10
        for m in range(1, max_m + 1):
            months.append(date(y, m, 1))

    for idx, m_date in enumerate(months):
        # Organic growth multiplier + Q4 seasonal boost + 2026 Q3 AI surge
        growth_factor = 1.0 + (idx * 0.045)
        if m_date.month in (10, 11, 12):
            growth_factor *= 1.18
        if m_date.year == 2026 and m_date.month in (8, 9, 10):
            growth_factor *= 1.22

        num_orders = int(85 * growth_factor)
        month_str = m_date.strftime("%Y-%m")
        for _ in range(num_orders):
            cid = rng.randint(1, 320)
            meta = customer_meta[cid]
            prod = rng.choice(products_data)
            pid, _, _, _, u_price, margin_pct = prod
            day_offset = rng.randint(0, 27)
            o_date = (m_date + timedelta(days=day_offset)).isoformat()

            base_qty = {"Enterprise": rng.randint(4, 18), "Mid-Market": rng.randint(2, 9), "SMB": rng.randint(1, 4), "Startup": rng.randint(1, 3)}[meta["segment"]]
            gross = round(u_price * base_qty, 2)
            disc_rate = rng.choice([0.0, 0.05, 0.10, 0.15, 0.20]) if meta["segment"] in ("Enterprise", "Mid-Market") else rng.choice([0.0, 0.05])
            disc = round(gross * disc_rate, 2)
            net = round(gross - disc, 2)
            profit = round(net * margin_pct, 2)
            fulfill_hrs = round(max(0.5, rng.gauss(6.5 if meta["region"] != "LATAM" else 11.2, 2.5)), 1)

            order_rows.append((
                oid,
                cid,
                pid,
                o_date,
                month_str,
                meta["region"],
                meta["segment"],
                meta["channel"],
                base_qty,
                gross,
                disc,
                net,
                profit,
                fulfill_hrs,
            ))
            oid += 1

    cur.executemany(
        "INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        order_rows,
    )

    # 5. Seed Marketing Campaigns
    camp_rows = []
    camp_id = 1
    for idx, m_date in enumerate(months):
        month_str = m_date.strftime("%Y-%m")
        for chan in channels:
            for reg in region_names:
                base_spend = {
                    "Paid Search": 14500,
                    "LinkedIn Ads": 18200,
                    "Organic Search": 4200,
                    "Product-Led": 6800,
                    "Partner Referral": 9500,
                    "Outbound Sales": 12000,
                }[chan]
                reg_scale = {"North America": 1.3, "Europe": 1.0, "APAC": 0.85, "LATAM": 0.5}[reg]
                spend = round(base_spend * reg_scale * rng.uniform(0.85, 1.25) * (1 + idx * 0.02), 2)
                impressions = int(spend * rng.uniform(18, 42))
                clicks = int(impressions * rng.uniform(0.018, 0.048))
                leads = int(clicks * rng.uniform(0.06, 0.16))
                conversions = max(1, int(leads * rng.uniform(0.14, 0.32)))
                roi_mult = {
                    "Product-Led": 6.4,
                    "Organic Search": 5.8,
                    "Partner Referral": 4.5,
                    "LinkedIn Ads": 3.4,
                    "Outbound Sales": 3.1,
                    "Paid Search": 2.9,
                }[chan]
                pipeline_val = round(spend * roi_mult * rng.uniform(0.85, 1.25), 2)
                camp_rows.append((
                    camp_id,
                    f"{chan} - {reg} ({month_str})",
                    chan,
                    reg,
                    month_str,
                    spend,
                    impressions,
                    clicks,
                    leads,
                    conversions,
                    pipeline_val,
                ))
                camp_id += 1

    cur.executemany(
        "INSERT INTO marketing_campaigns VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        camp_rows,
    )

    # 6. Seed Support Tickets (~900 tickets)
    priorities = ["P1-Critical", "P2-High", "P3-Medium", "P4-Low"]
    p_weights = [0.08, 0.22, 0.48, 0.22]
    ticket_cats = ["SQL Connector Auth", "Dashboard Latency", "SSO & Permissions", "Billing Inquiry", "Pipeline Schedule", "API Rate Limit"]
    ticket_rows = []
    for tid in range(1, 901):
        cid = rng.randint(1, 320)
        m_date = rng.choice(months)
        t_date = (m_date + timedelta(days=rng.randint(0, 27))).isoformat()
        t_month = m_date.strftime("%Y-%m")
        prio = rng.choices(priorities, weights=p_weights, k=1)[0]
        t_cat = rng.choice(ticket_cats)
        base_res = {"P1-Critical": 2.4, "P2-High": 6.8, "P3-Medium": 16.5, "P4-Low": 28.0}[prio]
        res_hrs = round(max(0.3, rng.gauss(base_res, base_res * 0.45)), 1)
        sla_limit = {"P1-Critical": 4.0, "P2-High": 12.0, "P3-Medium": 24.0, "P4-Low": 48.0}[prio]
        breached = 1 if res_hrs > sla_limit else 0
        csat = rng.choices([5, 4, 3, 2, 1], weights=[0.45, 0.32, 0.13, 0.06, 0.04] if not breached else [0.10, 0.20, 0.30, 0.25, 0.15], k=1)[0]
        ticket_rows.append((tid, cid, t_date, t_month, prio, t_cat, res_hrs, csat, breached))

    cur.executemany(
        "INSERT INTO support_tickets VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ticket_rows,
    )

    # Create analytical indexes
    cur.executescript(
        """
        CREATE INDEX idx_orders_month ON orders(order_month);
        CREATE INDEX idx_orders_region ON orders(region);
        CREATE INDEX idx_orders_customer ON orders(customer_id);
        CREATE INDEX idx_subs_status ON subscriptions(status);
        CREATE INDEX idx_campaigns_month ON marketing_campaigns(campaign_month);
        """
    )

    conn.commit()
    conn.close()
    return db_path
