import React from 'react';

function CategoryList({ categories, onDragStart }) {
    return (
        <ul className="list-group">
            {categories.map(cat => (
                <li
                    key={cat.id}
                    className="list-group-item d-flex justify-content-between align-items-center"
                    draggable // Make it draggable
                    onDragStart={(e) => onDragStart(e, cat)} // Pass category data on drag
                    style={{ cursor: 'grab' }}
                >
                    {cat.name}
                    <span
                        className="badge rounded-pill"
                        style={{ backgroundColor: cat.color, marginLeft: '10px', border: '1px solid #ccc' }}
                    >
                        &nbsp; {/* Non-breaking space for visibility */}
                    </span>
                </li>
            ))}
            {categories.length === 0 && <li className="list-group-item">No categories loaded.</li>}
        </ul>
    );
}

export default CategoryList;