from flask import Flask, jsonify, request, render_template
import json
import database as db

app = Flask(__name__)


@app.route('/')
def index():
    return render_template('index.html')


# ─── Board ──────────────────────────────────────────────────────────

@app.route('/api/board', methods=['GET'])
def get_board():
    board = db.get_board()
    return jsonify(board)


# ─── Columns ────────────────────────────────────────────────────────

@app.route('/api/columns', methods=['POST'])
def create_column():
    data = request.get_json()
    title = data.get('title', 'New Column')
    col = db.create_column(title)
    return jsonify(col), 201


@app.route('/api/columns/<int:col_id>', methods=['PUT'])
def update_column(col_id):
    data = request.get_json()
    col = db.update_column(
        col_id,
        title=data.get('title'),
        position=data.get('position')
    )
    if col is None:
        return jsonify({'error': 'Column not found'}), 404
    return jsonify(col)


@app.route('/api/columns/<int:col_id>', methods=['DELETE'])
def delete_column(col_id):
    db.delete_column(col_id)
    return jsonify({'success': True})


@app.route('/api/columns/reorder', methods=['PUT'])
def reorder_columns():
    data = request.get_json()
    column_ids = data.get('column_ids', [])
    db.reorder_columns(column_ids)
    return jsonify({'success': True})


# ─── Cards ──────────────────────────────────────────────────────────

@app.route('/api/cards', methods=['POST'])
def create_card():
    data = request.get_json()
    card = db.create_card(
        column_id=data['column_id'],
        title=data.get('title', 'New Card'),
        description=data.get('description', ''),
        labels=data.get('labels', '[]')
    )
    return jsonify(card), 201


@app.route('/api/cards/<int:card_id>', methods=['PUT'])
def update_card(card_id):
    data = request.get_json()
    kwargs = {}
    for key in ['title', 'description', 'column_id', 'position', 'labels']:
        if key in data:
            kwargs[key] = data[key]
    card = db.update_card(card_id, **kwargs)
    if card is None:
        return jsonify({'error': 'Card not found'}), 404
    return jsonify(card)


@app.route('/api/cards/<int:card_id>', methods=['DELETE'])
def delete_card(card_id):
    db.delete_card(card_id)
    return jsonify({'success': True})


@app.route('/api/cards/reorder', methods=['PUT'])
def reorder_cards():
    data = request.get_json()
    card_orders = data.get('cards', [])
    db.reorder_cards(card_orders)
    return jsonify({'success': True})


if __name__ == '__main__':
    db.init_db()
    app.run(host='0.0.0.0', port=5454, debug=True)
