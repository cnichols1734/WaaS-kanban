import sqlite3
import os
from datetime import datetime
import json

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'kanban.db')

DEFAULT_COLUMNS = [
    "New Leads",
    "Researching",
    "Research Complete",
    "Website Built",
    "Pitched",
    "Subscribed",
]


def get_db():
    """Get a database connection with row factory."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    """Initialize the database schema and seed default columns."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.executescript('''
        CREATE TABLE IF NOT EXISTS columns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            position INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS cards (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            column_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            position INTEGER NOT NULL,
            labels TEXT DEFAULT '[]',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (column_id) REFERENCES columns(id) ON DELETE CASCADE
        );
    ''')

    # Seed default columns if table is empty
    count = cursor.execute("SELECT COUNT(*) FROM columns").fetchone()[0]
    if count == 0:
        for i, title in enumerate(DEFAULT_COLUMNS):
            cursor.execute(
                "INSERT INTO columns (title, position) VALUES (?, ?)",
                (title, i)
            )

    conn.commit()
    conn.close()


# ─── Column Operations ──────────────────────────────────────────────

def get_all_columns():
    """Return all columns ordered by position."""
    conn = get_db()
    cols = conn.execute(
        "SELECT * FROM columns ORDER BY position"
    ).fetchall()
    conn.close()
    return [dict(c) for c in cols]


def create_column(title):
    """Create a new column at the end."""
    conn = get_db()
    max_pos = conn.execute(
        "SELECT COALESCE(MAX(position), -1) FROM columns"
    ).fetchone()[0]
    cursor = conn.execute(
        "INSERT INTO columns (title, position) VALUES (?, ?)",
        (title, max_pos + 1)
    )
    col_id = cursor.lastrowid
    conn.commit()
    col = conn.execute("SELECT * FROM columns WHERE id = ?", (col_id,)).fetchone()
    conn.close()
    return dict(col)


def update_column(col_id, title=None, position=None):
    """Update a column's title and/or position."""
    conn = get_db()
    col = conn.execute("SELECT * FROM columns WHERE id = ?", (col_id,)).fetchone()
    if not col:
        conn.close()
        return None

    new_title = title if title is not None else col['title']
    new_pos = position if position is not None else col['position']

    conn.execute(
        "UPDATE columns SET title = ?, position = ? WHERE id = ?",
        (new_title, new_pos, col_id)
    )
    conn.commit()
    updated = conn.execute("SELECT * FROM columns WHERE id = ?", (col_id,)).fetchone()
    conn.close()
    return dict(updated)


def delete_column(col_id):
    """Delete a column and all its cards."""
    conn = get_db()
    conn.execute("DELETE FROM columns WHERE id = ?", (col_id,))
    conn.commit()
    conn.close()


def reorder_columns(column_ids):
    """Reorder columns by a list of column IDs."""
    conn = get_db()
    for i, cid in enumerate(column_ids):
        conn.execute("UPDATE columns SET position = ? WHERE id = ?", (i, cid))
    conn.commit()
    conn.close()


# ─── Card Operations ────────────────────────────────────────────────

def get_cards_for_column(column_id):
    """Return all cards in a column ordered by position."""
    conn = get_db()
    cards = conn.execute(
        "SELECT * FROM cards WHERE column_id = ? ORDER BY position",
        (column_id,)
    ).fetchall()
    conn.close()
    return [dict(c) for c in cards]


def get_all_cards():
    """Return all cards grouped by column."""
    conn = get_db()
    cards = conn.execute(
        "SELECT * FROM cards ORDER BY column_id, position"
    ).fetchall()
    conn.close()
    return [dict(c) for c in cards]


def create_card(column_id, title, description='', labels='[]'):
    """Create a new card at the bottom of a column."""
    conn = get_db()
    max_pos = conn.execute(
        "SELECT COALESCE(MAX(position), -1) FROM cards WHERE column_id = ?",
        (column_id,)
    ).fetchone()[0]
    now = datetime.utcnow().isoformat()
    if isinstance(labels, (list, dict)):
        labels = json.dumps(labels)

    cursor = conn.execute(
        "INSERT INTO cards (column_id, title, description, position, labels, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (column_id, title, description, max_pos + 1, labels, now, now)
    )
    card_id = cursor.lastrowid
    conn.commit()
    card = conn.execute("SELECT * FROM cards WHERE id = ?", (card_id,)).fetchone()
    conn.close()
    return dict(card)


def update_card(card_id, **kwargs):
    """Update a card's fields. Accepts: title, description, column_id, position, labels."""
    conn = get_db()
    card = conn.execute("SELECT * FROM cards WHERE id = ?", (card_id,)).fetchone()
    if not card:
        conn.close()
        return None

    card = dict(card)
    allowed = ['title', 'description', 'column_id', 'position', 'labels']
    for key in allowed:
        if key in kwargs:
            val = kwargs[key]
            if key == 'labels' and isinstance(val, (list, dict)):
                val = json.dumps(val)
            card[key] = val

    card['updated_at'] = datetime.utcnow().isoformat()

    conn.execute(
        "UPDATE cards SET title=?, description=?, column_id=?, position=?, labels=?, updated_at=? WHERE id=?",
        (card['title'], card['description'], card['column_id'],
         card['position'], card['labels'], card['updated_at'], card_id)
    )
    conn.commit()
    updated = conn.execute("SELECT * FROM cards WHERE id = ?", (card_id,)).fetchone()
    conn.close()
    return dict(updated)


def delete_card(card_id):
    """Delete a card."""
    conn = get_db()
    conn.execute("DELETE FROM cards WHERE id = ?", (card_id,))
    conn.commit()
    conn.close()


def reorder_cards(card_orders):
    """
    Reorder cards. Expects a list of dicts:
    [{"id": 1, "column_id": 2, "position": 0}, ...]
    """
    conn = get_db()
    now = datetime.utcnow().isoformat()
    for item in card_orders:
        conn.execute(
            "UPDATE cards SET column_id=?, position=?, updated_at=? WHERE id=?",
            (item['column_id'], item['position'], now, item['id'])
        )
    conn.commit()
    conn.close()


def get_board():
    """Get full board state: columns with their cards."""
    columns = get_all_columns()
    cards = get_all_cards()

    card_map = {}
    for card in cards:
        col_id = card['column_id']
        if col_id not in card_map:
            card_map[col_id] = []
        card_map[col_id].append(card)

    for col in columns:
        col['cards'] = card_map.get(col['id'], [])

    return columns
