/* ============================================================
   DBSchemaViz — examples.js
   Pre-loaded SQL schemas for the example buttons.
   Each key maps to a button in the examples bar in index.html.
   ============================================================ */

const examples = {

  /* ── E-Commerce ──────────────────────────────────────────── */
  ecommerce: `CREATE TABLE users (
  id            SERIAL       PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  name          VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active     BOOLEAN      DEFAULT TRUE,
  created_at    TIMESTAMP    DEFAULT NOW()
);

CREATE TABLE categories (
  id        SERIAL       PRIMARY KEY,
  name      VARCHAR(100) NOT NULL,
  parent_id INT          REFERENCES categories(id),
  slug      VARCHAR(100) UNIQUE
);

CREATE TABLE products (
  id          SERIAL        PRIMARY KEY,
  name        VARCHAR(255)  NOT NULL,
  description TEXT,
  price       DECIMAL(10,2) NOT NULL,
  stock_qty   INT           DEFAULT 0,
  category_id INT           REFERENCES categories(id),
  created_at  TIMESTAMP     DEFAULT NOW()
);

CREATE TABLE orders (
  id               SERIAL        PRIMARY KEY,
  user_id          INT           REFERENCES users(id),
  status           VARCHAR(50)   DEFAULT 'pending',
  total            DECIMAL(10,2) NOT NULL,
  shipping_address TEXT,
  created_at       TIMESTAMP     DEFAULT NOW()
);

CREATE TABLE order_items (
  id         SERIAL        PRIMARY KEY,
  order_id   INT           REFERENCES orders(id),
  product_id INT           REFERENCES products(id),
  quantity   INT           NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL
);

CREATE TABLE reviews (
  id         SERIAL    PRIMARY KEY,
  product_id INT       REFERENCES products(id),
  user_id    INT       REFERENCES users(id),
  rating     INT       NOT NULL,
  comment    TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);`,

  /* ── Blog ────────────────────────────────────────────────── */
  blog: `CREATE TABLE authors (
  id         SERIAL       PRIMARY KEY,
  username   VARCHAR(80)  NOT NULL UNIQUE,
  email      VARCHAR(255) NOT NULL UNIQUE,
  bio        TEXT,
  avatar_url VARCHAR(500),
  created_at TIMESTAMP    DEFAULT NOW()
);

CREATE TABLE tags (
  id   SERIAL      PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  slug VARCHAR(50) UNIQUE
);

CREATE TABLE posts (
  id           SERIAL       PRIMARY KEY,
  title        VARCHAR(255) NOT NULL,
  slug         VARCHAR(255) NOT NULL UNIQUE,
  content      TEXT         NOT NULL,
  excerpt      TEXT,
  author_id    INT          REFERENCES authors(id),
  is_published BOOLEAN      DEFAULT FALSE,
  published_at TIMESTAMP,
  created_at   TIMESTAMP    DEFAULT NOW()
);

CREATE TABLE post_tags (
  post_id INT REFERENCES posts(id),
  tag_id  INT REFERENCES tags(id),
  PRIMARY KEY (post_id, tag_id)
);

CREATE TABLE comments (
  id        SERIAL    PRIMARY KEY,
  post_id   INT       REFERENCES posts(id),
  author_id INT       REFERENCES authors(id),
  parent_id INT       REFERENCES comments(id),
  content   TEXT      NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);`,

  /* ── SaaS App ────────────────────────────────────────────── */
  saas: `CREATE TABLE organizations (
  id           SERIAL       PRIMARY KEY,
  name         VARCHAR(255) NOT NULL,
  slug         VARCHAR(100) NOT NULL UNIQUE,
  plan         VARCHAR(50)  DEFAULT 'free',
  trial_ends_at TIMESTAMP,
  created_at   TIMESTAMP    DEFAULT NOW()
);

CREATE TABLE users (
  id           SERIAL       PRIMARY KEY,
  org_id       INT          REFERENCES organizations(id),
  email        VARCHAR(255) NOT NULL UNIQUE,
  role         VARCHAR(50)  DEFAULT 'member',
  is_active    BOOLEAN      DEFAULT TRUE,
  last_login_at TIMESTAMP,
  created_at   TIMESTAMP    DEFAULT NOW()
);

CREATE TABLE projects (
  id          SERIAL       PRIMARY KEY,
  org_id      INT          REFERENCES organizations(id),
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  owner_id    INT          REFERENCES users(id),
  is_archived BOOLEAN      DEFAULT FALSE,
  created_at  TIMESTAMP    DEFAULT NOW()
);

CREATE TABLE api_keys (
  id          SERIAL       PRIMARY KEY,
  org_id      INT          REFERENCES organizations(id),
  user_id     INT          REFERENCES users(id),
  key_hash    VARCHAR(255) NOT NULL UNIQUE,
  label       VARCHAR(100),
  last_used_at TIMESTAMP,
  expires_at  TIMESTAMP,
  created_at  TIMESTAMP    DEFAULT NOW()
);

CREATE TABLE audit_logs (
  id            SERIAL      PRIMARY KEY,
  org_id        INT         REFERENCES organizations(id),
  user_id       INT         REFERENCES users(id),
  action        VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id   INT,
  metadata      JSONB,
  created_at    TIMESTAMP   DEFAULT NOW()
);`,

  /* ── Multi-Schema (company / hr / sales) ─────────────────── */
  multischema: `-- Schema: company (reference / master data)
CREATE TABLE company.departments (
  department_id   INT          PRIMARY KEY,
  department_name VARCHAR(100) NOT NULL
);

CREATE TABLE company.locations (
  location_id INT          PRIMARY KEY,
  city        VARCHAR(100) NOT NULL,
  state       VARCHAR(100)
);

-- Schema: hr (people)
CREATE TABLE hr.employees (
  employee_id   INT          PRIMARY KEY,
  first_name    VARCHAR(100) NOT NULL,
  last_name     VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  department_id INT          NOT NULL,
  location_id   INT          NOT NULL,
  hire_date     DATE         NOT NULL,
  CONSTRAINT fk_emp_department
    FOREIGN KEY (department_id)
    REFERENCES company.departments(department_id),
  CONSTRAINT fk_emp_location
    FOREIGN KEY (location_id)
    REFERENCES company.locations(location_id)
);

-- Schema: sales (transactions)
CREATE TABLE sales.customers (
  customer_id   INT          PRIMARY KEY,
  customer_name VARCHAR(150) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE
);

CREATE TABLE sales.products (
  product_id   INT           PRIMARY KEY,
  product_name VARCHAR(150)  NOT NULL,
  price        DECIMAL(10,2) NOT NULL
);

CREATE TABLE sales.orders (
  order_id    INT  PRIMARY KEY,
  customer_id INT  NOT NULL,
  employee_id INT  NOT NULL,
  order_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  CONSTRAINT fk_order_customer
    FOREIGN KEY (customer_id)
    REFERENCES sales.customers(customer_id),
  CONSTRAINT fk_order_employee
    FOREIGN KEY (employee_id)
    REFERENCES hr.employees(employee_id)
);

-- Junction table: composite PK (best practice — no surrogate key needed)
CREATE TABLE sales.order_details (
  order_id   INT           NOT NULL,
  product_id INT           NOT NULL,
  quantity   INT           NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (order_id, product_id),
  CONSTRAINT fk_detail_order
    FOREIGN KEY (order_id)
    REFERENCES sales.orders(order_id),
  CONSTRAINT fk_detail_product
    FOREIGN KEY (product_id)
    REFERENCES sales.products(product_id)
);`,

  /* ── Hospital ────────────────────────────────────────────── */
  hospital: `CREATE TABLE patients (
  id         SERIAL       PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name  VARCHAR(100) NOT NULL,
  dob        DATE         NOT NULL,
  gender     VARCHAR(20),
  phone      VARCHAR(20),
  email      VARCHAR(255),
  created_at TIMESTAMP    DEFAULT NOW()
);

CREATE TABLE departments (
  id              SERIAL       PRIMARY KEY,
  name            VARCHAR(100) NOT NULL UNIQUE,
  head_doctor_id  INT          REFERENCES doctors(id)
);

CREATE TABLE doctors (
  id             SERIAL      PRIMARY KEY,
  first_name     VARCHAR(100) NOT NULL,
  last_name      VARCHAR(100) NOT NULL,
  specialty      VARCHAR(100),
  license_number VARCHAR(50)  UNIQUE,
  department_id  INT          REFERENCES departments(id)
);

CREATE TABLE appointments (
  id           SERIAL      PRIMARY KEY,
  patient_id   INT         REFERENCES patients(id),
  doctor_id    INT         REFERENCES doctors(id),
  scheduled_at TIMESTAMP   NOT NULL,
  status       VARCHAR(50) DEFAULT 'scheduled',
  notes        TEXT
);

CREATE TABLE prescriptions (
  id         SERIAL       PRIMARY KEY,
  patient_id INT          REFERENCES patients(id),
  doctor_id  INT          REFERENCES doctors(id),
  medication VARCHAR(255) NOT NULL,
  dosage     VARCHAR(100),
  start_date DATE,
  end_date   DATE,
  created_at TIMESTAMP    DEFAULT NOW()
);`,

};

/** Load an example into the SQL textarea. */
function loadExample(name) {
  document.getElementById('sql-input').value = examples[name] || '';
}
