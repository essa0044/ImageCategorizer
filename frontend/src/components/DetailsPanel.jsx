import React, { useState, useEffect } from 'react';

function DetailsPanel({ rectangle, categories, onChangeCategory, onChangeHierarchy }) {
    const [hierarchyValue, setHierarchyValue] = useState(rectangle.hierarchy || '');

    // Update local state if the selected rectangle changes
    useEffect(() => {
        setHierarchyValue(rectangle.hierarchy || '');
    }, [rectangle]);

    const handleHierarchyChange = (e) => {
        setHierarchyValue(e.target.value);
    };

    const handleHierarchyBlur = () => {
        // Validate format (simple check for digits and dots)
        if (/^(\d+\.)*\d+$/.test(hierarchyValue) || hierarchyValue === '') {
             onChangeHierarchy(rectangle.id, hierarchyValue);
        } else {
             alert('Invalid Hierarchy format. Use numbers separated by dots (e.g., 1.2.1)');
             // Optionally reset to previous value: setHierarchyValue(rectangle.hierarchy || '');
        }
    };

    const handleCategoryClick = (categoryId) => {
        onChangeCategory(rectangle.id, categoryId);
    };

    const currentCategory = categories.find(cat => cat.id === rectangle.categoryId);

    return (
        <div className="p-3 border rounded">
            <h4>Details</h4>
            <p>Selected: Rectangle {rectangle.id.substring(0, 6)}</p>
            {currentCategory && (
                 <p>Current Category: <span className="badge" style={{backgroundColor: currentCategory.color}}>{currentCategory.name}</span></p>
             )}

            <div className="mb-3">
                <label htmlFor="hierarchyInput" className="form-label">Hierarchy Level</label>
                <input
                    type="text"
                    className="form-control"
                    id="hierarchyInput"
                    value={hierarchyValue}
                    onChange={handleHierarchyChange}
                    onBlur={handleHierarchyBlur} // Validate on losing focus
                    placeholder="e.g., 1.1 or 2.3.4"
                />
                <div className="form-text">Format: 1.2.3... (numbers separated by dots)</div>
            </div>

            <h5>Change Category:</h5>
            <div className="list-group list-group-flush">
                {categories.map(cat => (
                    <button
                        key={cat.id}
                        type="button"
                        className={`list-group-item list-group-item-action ${rectangle.categoryId === cat.id ? 'active' : ''}`}
                        onClick={() => handleCategoryClick(cat.id)}
                    >
                         <span className="badge rounded-pill me-2" style={{ backgroundColor: cat.color, border: '1px solid #ccc' }}>&nbsp;</span>
                         {cat.name}
                    </button>
                ))}
            </div>
        </div>
    );
}

export default DetailsPanel;