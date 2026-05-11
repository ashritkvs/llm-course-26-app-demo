import hashlib
import secrets
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path

DB_NAME = Path(__file__).resolve().parent.parent / "mindjournal.db"


def get_connection():
    conn = sqlite3.connect(DB_NAME, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def _column_exists(cursor, table_name, column_name):
    cursor.execute(f"PRAGMA table_info({table_name})")
    return any(row["name"] == column_name for row in cursor.fetchall())


def _hash_password(password: str, salt: str) -> str:
    return hashlib.sha256(f"{salt}:{password}".encode("utf-8")).hexdigest()


def _normalize_entry_date(value: str | None) -> tuple[str, str]:
    if value:
        raw = value.strip()
        parsed = datetime.fromisoformat(raw)
    else:
        parsed = datetime.now()

    return parsed.date().isoformat(), parsed.isoformat()


def _deduplicate_entries_by_day(cursor):
    cursor.execute(
        """
        SELECT user_id, entry_date, MAX(id) AS keep_id
        FROM entries
        WHERE user_id IS NOT NULL AND entry_date IS NOT NULL
        GROUP BY user_id, entry_date
        HAVING COUNT(*) > 1
        """
    )
    duplicate_groups = cursor.fetchall()

    for group in duplicate_groups:
        cursor.execute(
            """
            SELECT id
            FROM entries
            WHERE user_id = ? AND entry_date = ? AND id != ?
            """,
            (group["user_id"], group["entry_date"], group["keep_id"]),
        )
        duplicate_ids = [row["id"] for row in cursor.fetchall()]
        if not duplicate_ids:
            continue

        for entry_id in duplicate_ids:
            cursor.execute("DELETE FROM reframes WHERE entry_id = ?", (entry_id,))
            cursor.execute("DELETE FROM actions WHERE entry_id = ?", (entry_id,))
            cursor.execute("DELETE FROM entries WHERE id = ?", (entry_id,))


def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            text TEXT,
            emotion TEXT,
            intensity INTEGER,
            category TEXT,
            trigger TEXT,
            distortion TEXT,
            insight TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )

    if not _column_exists(cursor, "entries", "user_id"):
        cursor.execute("ALTER TABLE entries ADD COLUMN user_id INTEGER")

    if not _column_exists(cursor, "entries", "entry_date"):
        cursor.execute("ALTER TABLE entries ADD COLUMN entry_date TEXT")

    cursor.execute(
        """
        UPDATE entries
        SET entry_date = substr(created_at, 1, 10)
        WHERE entry_date IS NULL
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS reframes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entry_id INTEGER,
            text TEXT,
            FOREIGN KEY(entry_id) REFERENCES entries(id)
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS actions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entry_id INTEGER,
            text TEXT,
            FOREIGN KEY(entry_id) REFERENCES entries(id)
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS user_profiles (
            user_id INTEGER PRIMARY KEY,
            name TEXT,
            age INTEGER,
            mental_health_status TEXT,
            stress_level INTEGER,
            exercise_routine TEXT,
            eating_habits TEXT,
            sleep_hours REAL,
            mood_trends TEXT,
            social_interaction TEXT,
            work_pressure TEXT,
            hobbies TEXT,
            additional_notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS auth_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_salt TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS auth_sessions (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES auth_users(id)
        )
        """
    )

    _deduplicate_entries_by_day(cursor)
    cursor.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_entries_user_entry_date
        ON entries (user_id, entry_date)
        WHERE user_id IS NOT NULL AND entry_date IS NOT NULL
        """
    )

    conn.commit()
    conn.close()


def get_user_profile(user_id, conn=None):
    owns_connection = conn is None
    conn = conn or get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT
            user_id,
            name,
            age,
            mental_health_status,
            stress_level,
            exercise_routine,
            eating_habits,
            sleep_hours,
            mood_trends,
            social_interaction,
            work_pressure,
            hobbies,
            additional_notes
        FROM user_profiles
        WHERE user_id = ?
        """,
        (user_id,),
    )

    row = cursor.fetchone()
    if owns_connection:
        conn.close()

    return dict(row) if row else None


def ensure_user_profile(user_id, conn=None):
    owns_connection = conn is None
    conn = conn or get_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT OR IGNORE INTO user_profiles (user_id) VALUES (?)", (user_id,))
    conn.commit()
    if owns_connection:
        conn.close()


def upsert_user_profile(profile_data, conn=None):
    owns_connection = conn is None
    conn = conn or get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        INSERT INTO user_profiles (
            user_id,
            name,
            age,
            mental_health_status,
            stress_level,
            exercise_routine,
            eating_habits,
            sleep_hours,
            mood_trends,
            social_interaction,
            work_pressure,
            hobbies,
            additional_notes,
            updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
            name = excluded.name,
            age = excluded.age,
            mental_health_status = excluded.mental_health_status,
            stress_level = excluded.stress_level,
            exercise_routine = excluded.exercise_routine,
            eating_habits = excluded.eating_habits,
            sleep_hours = excluded.sleep_hours,
            mood_trends = excluded.mood_trends,
            social_interaction = excluded.social_interaction,
            work_pressure = excluded.work_pressure,
            hobbies = excluded.hobbies,
            additional_notes = excluded.additional_notes,
            updated_at = CURRENT_TIMESTAMP
        """,
        (
            profile_data["user_id"],
            profile_data.get("name"),
            profile_data.get("age"),
            profile_data.get("mental_health_status"),
            profile_data.get("stress_level"),
            profile_data.get("exercise_routine"),
            profile_data.get("eating_habits"),
            profile_data.get("sleep_hours"),
            profile_data.get("mood_trends"),
            profile_data.get("social_interaction"),
            profile_data.get("work_pressure"),
            profile_data.get("hobbies"),
            profile_data.get("additional_notes"),
        ),
    )

    conn.commit()
    if owns_connection:
        conn.close()


def create_auth_user(email: str, password: str, conn=None):
    owns_connection = conn is None
    conn = conn or get_connection()
    cursor = conn.cursor()

    salt = secrets.token_hex(16)
    password_hash = _hash_password(password, salt)

    cursor.execute(
        """
        INSERT INTO auth_users (email, password_salt, password_hash)
        VALUES (?, ?, ?)
        """,
        (email.lower().strip(), salt, password_hash),
    )
    user_id = cursor.lastrowid
    conn.commit()
    ensure_user_profile(user_id, conn=conn)

    if owns_connection:
        conn.close()

    return user_id


def get_auth_user_by_email(email: str, conn=None):
    owns_connection = conn is None
    conn = conn or get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT id, email, password_salt, password_hash, created_at
        FROM auth_users
        WHERE email = ?
        """,
        (email.lower().strip(),),
    )
    row = cursor.fetchone()
    if owns_connection:
        conn.close()
    return row


def get_auth_user_by_id(user_id: int, conn=None):
    owns_connection = conn is None
    conn = conn or get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT id, email, created_at
        FROM auth_users
        WHERE id = ?
        """,
        (user_id,),
    )
    row = cursor.fetchone()
    if owns_connection:
        conn.close()
    return row


def authenticate_auth_user(email: str, password: str, conn=None):
    owns_connection = conn is None
    conn = conn or get_connection()
    row = get_auth_user_by_email(email, conn=conn)
    if not row:
        if owns_connection:
            conn.close()
        return None

    expected_hash = _hash_password(password, row["password_salt"])
    if expected_hash != row["password_hash"]:
        if owns_connection:
            conn.close()
        return None

    if owns_connection:
        conn.close()
    return row


def create_auth_session(user_id: int, conn=None):
    owns_connection = conn is None
    conn = conn or get_connection()
    cursor = conn.cursor()
    token = secrets.token_urlsafe(32)
    cursor.execute(
        """
        INSERT INTO auth_sessions (token, user_id)
        VALUES (?, ?)
        """,
        (token, user_id),
    )
    conn.commit()
    if owns_connection:
        conn.close()
    return token


def get_auth_user_by_token(token: str, conn=None):
    owns_connection = conn is None
    conn = conn or get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT u.id, u.email, u.created_at
        FROM auth_sessions s
        JOIN auth_users u ON u.id = s.user_id
        WHERE s.token = ?
        """,
        (token,),
    )
    row = cursor.fetchone()
    if owns_connection:
        conn.close()
    return row


def delete_auth_session(token: str, conn=None):
    owns_connection = conn is None
    conn = conn or get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM auth_sessions WHERE token = ?", (token,))
    conn.commit()
    if owns_connection:
        conn.close()


def save_entry(entry_text, result, created_at=None, user_id=None, conn=None):
    owns_connection = conn is None
    conn = conn or get_connection()
    cursor = conn.cursor()
    entry_date, created_at_value = _normalize_entry_date(created_at)

    cursor.execute(
        """
        SELECT id
        FROM entries
        WHERE user_id = ? AND entry_date = ?
        """,
        (user_id, entry_date),
    )
    existing_row = cursor.fetchone()

    if existing_row:
        entry_id = existing_row["id"]
        cursor.execute(
            """
            UPDATE entries
            SET
                text = ?,
                emotion = ?,
                intensity = ?,
                category = ?,
                trigger = ?,
                distortion = ?,
                insight = ?,
                created_at = ?,
                user_id = ?,
                entry_date = ?
            WHERE id = ?
            """,
            (
                entry_text,
                result.get("emotion"),
                result.get("intensity"),
                result.get("category"),
                result.get("trigger"),
                result.get("distortion"),
                result.get("core_insight", result.get("insight")),
                created_at_value,
                user_id,
                entry_date,
                entry_id,
            ),
        )
        cursor.execute("DELETE FROM reframes WHERE entry_id = ?", (entry_id,))
        cursor.execute("DELETE FROM actions WHERE entry_id = ?", (entry_id,))
    else:
        entry_payload = (
            entry_text,
            result.get("emotion"),
            result.get("intensity"),
            result.get("category"),
            result.get("trigger"),
            result.get("distortion"),
            result.get("core_insight", result.get("insight")),
            created_at_value,
            user_id,
            entry_date,
        )

        cursor.execute(
            """
            INSERT INTO entries (
                text,
                emotion,
                intensity,
                category,
                trigger,
                distortion,
                insight,
                created_at,
                user_id,
                entry_date
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            entry_payload,
        )

        entry_id = cursor.lastrowid

    for reframe in result.get("reframes", []):
        cursor.execute(
            """
            INSERT INTO reframes (entry_id, text)
            VALUES (?, ?)
            """,
            (entry_id, reframe),
        )

    for action in result.get("actions", []):
        cursor.execute(
            """
            INSERT INTO actions (entry_id, text)
            VALUES (?, ?)
            """,
            (entry_id, action),
        )

    conn.commit()
    if owns_connection:
        conn.close()

    return entry_id


def get_last_7_days(user_id=None, conn=None):
    owns_connection = conn is None
    conn = conn or get_connection()
    cursor = conn.cursor()

    seven_days_ago = (datetime.now() - timedelta(days=7)).date().isoformat()

    if user_id is None:
        cursor.execute(
            """
            SELECT created_at, intensity, category, emotion, trigger
            FROM entries
            WHERE entry_date >= ?
            ORDER BY entry_date ASC
            """,
            (seven_days_ago,),
        )
    else:
        cursor.execute(
            """
            SELECT created_at, intensity, category, emotion, trigger
            FROM entries
            WHERE entry_date >= ? AND user_id = ?
            ORDER BY entry_date ASC
            """,
            (seven_days_ago, user_id),
        )

    rows = cursor.fetchall()
    if owns_connection:
        conn.close()

    return rows


def get_all_entries(user_id=None, conn=None):
    owns_connection = conn is None
    conn = conn or get_connection()
    cursor = conn.cursor()

    if user_id is None:
        cursor.execute(
            """
            SELECT id, text, emotion, intensity, category, trigger, distortion, insight, created_at, user_id
            FROM entries
            ORDER BY created_at DESC
            """
        )
    else:
        cursor.execute(
            """
            SELECT id, text, emotion, intensity, category, trigger, distortion, insight, created_at, user_id
            FROM entries
            WHERE user_id = ?
            ORDER BY created_at DESC
            """,
            (user_id,),
        )

    rows = cursor.fetchall()
    if owns_connection:
        conn.close()

    return rows


def get_entry(entry_id, conn=None):
    owns_connection = conn is None
    conn = conn or get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT id, text, emotion, intensity, category, trigger, distortion, insight, created_at, user_id
        FROM entries
        WHERE id = ?
        """,
        (entry_id,),
    )

    row = cursor.fetchone()
    if owns_connection:
        conn.close()

    return row


def get_reframes_for_entry(entry_id, conn=None):
    owns_connection = conn is None
    conn = conn or get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT text
        FROM reframes
        WHERE entry_id = ?
        ORDER BY id ASC
        """,
        (entry_id,),
    )

    rows = [row["text"] for row in cursor.fetchall()]
    if owns_connection:
        conn.close()

    return rows


def get_actions_for_entry(entry_id, conn=None):
    owns_connection = conn is None
    conn = conn or get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT text
        FROM actions
        WHERE entry_id = ?
        ORDER BY id ASC
        """,
        (entry_id,),
    )

    rows = [row["text"] for row in cursor.fetchall()]
    if owns_connection:
        conn.close()

    return rows
