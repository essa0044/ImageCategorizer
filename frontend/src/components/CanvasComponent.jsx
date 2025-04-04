// frontend/src/components/CanvasComponent.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react'; // Added useCallback
import { Stage, Layer, Image as KonvaImage, Rect, Transformer } from 'react-konva';
import useImage from 'use-image';

// Helper (no changes)
const getCategoryColor = (categoryId, categories, defaultColor = 'grey') => {
    const category = categories.find(cat => cat.id === categoryId);
    return category ? category.color : defaultColor;
};

// --- CanvasRectangle Component ---
// Added stageSize prop and dragBoundFunc implementation
const CanvasRectangle = ({ shapeProps, isSelected, onSelect, onChange, categoryColor, stageSize }) => {
    const shapeRef = useRef();
    const trRef = useRef();

    useEffect(() => {
        if (isSelected && trRef.current && shapeRef.current) { // Check shapeRef too
            trRef.current.nodes([shapeRef.current]);
            trRef.current.getLayer()?.batchDraw();
        }
    }, [isSelected]);

    // --- Drag Bounds Function ---
    const keepInBounds = useCallback((pos) => {
        const node = shapeRef.current;
        if (!node || !stageSize || stageSize.width === 0 || stageSize.height === 0) {
            return pos;
        }
        const scaleX = node.scaleX() || 1;
        const scaleY = node.scaleY() || 1;
        const nodeWidth = node.width() * scaleX;
        const nodeHeight = node.height() * scaleY;

        // Clamp position within stage boundaries
        const newX = Math.max(0, Math.min(pos.x, stageSize.width - nodeWidth));
        const newY = Math.max(0, Math.min(pos.y, stageSize.height - nodeHeight));
        return { x: newX, y: newY };
    }, [stageSize]); // Depends only on stageSize

    // --- Handle Transform End with Bounds ---
    const handleTransformEnd = useCallback((e) => {
        const node = shapeRef.current;
        if (!node || !stageSize) return;

        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        node.scaleX(1); node.scaleY(1); // Reset scale

        let newWidth = Math.max(5, node.width() * scaleX);
        let newHeight = Math.max(5, node.height() * scaleY);
        let newX = node.x();
        let newY = node.y();

        // Clamp position after transform (in case it was moved out)
        if (newX < 0) { newWidth += newX; newX = 0; } // Adjust width if moved left
        if (newY < 0) { newHeight += newY; newY = 0; } // Adjust height if moved up

        // Clamp size based on clamped position
        newWidth = Math.min(newWidth, stageSize.width - newX);
        newHeight = Math.min(newHeight, stageSize.height - newY);

        // Ensure minimum size
        newWidth = Math.max(5, newWidth);
        newHeight = Math.max(5, newHeight);

        const updatedShape = {
            ...shapeProps,
            x: newX,
            y: newY,
            width: newWidth,
            height: newHeight,
        };
        onChange(updatedShape); // Call the onChange passed from App.jsx
        console.log(`Resized: ${updatedShape.id}, XYWH: (${Math.round(updatedShape.x)}, ${Math.round(updatedShape.y)}, ${Math.round(updatedShape.width)}, ${Math.round(updatedShape.height)})`);
    }, [stageSize, shapeProps, onChange]); // Add dependencies

    // --- Handle Drag End with Bounds ---
     const handleDragEnd = useCallback((e) => {
        // Apply bounds check to the final position
        const finalPos = keepInBounds(e.target.position());
        const updatedShape = {
            ...shapeProps,
            x: finalPos.x,
            y: finalPos.y,
        };
        onChange(updatedShape); // Call the onChange passed from App.jsx
        console.log(`Moved: ${updatedShape.id}, XY: (${Math.round(updatedShape.x)}, ${Math.round(updatedShape.y)})`);
    }, [shapeProps, keepInBounds, onChange]); // Add dependencies

    return (
        <React.Fragment>
            <Rect
                onClick={onSelect} // Simplified from user provided
                onTap={onSelect}   // Keep for mobile
                ref={shapeRef}
                {...shapeProps}
                fill={categoryColor}
                opacity={0.6}
                draggable
                dragBoundFunc={keepInBounds} // Apply drag bounds
                onDragEnd={handleDragEnd}     // Apply bounds on drag end
                onTransformEnd={handleTransformEnd} // Apply bounds on transform end
            />
            {isSelected && (
                <Transformer
                    ref={trRef}
                    boundBoxFunc={(oldBox, newBox) => {
                        // Primarily prevent negative sizes here
                        if (newBox.width < 5 || newBox.height < 5) {
                            return oldBox;
                        }
                        // More complex boundary logic is handled in onTransformEnd
                        return newBox;
                    }}
                    // Keep resizing anchors only on corners if needed:
                    // enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
                    // rotateEnabled={false} // Disable rotation if not needed
                />
            )}
        </React.Fragment>
    );
};


// --- CanvasComponent ---
// stageRef prop is received from App.jsx
const CanvasComponent = ({ imageSrc, rectangles, selectedRectId, onRectSelect, onRectChange, categories, stageRef }) => {
    const [image] = useImage(imageSrc, 'Anonymous');
    // Stage size state, initialized to 0
    const [stageSize, setStageSize] = useState({ width: 0, height: 0 });

    // Effect to update stage size when image loads/changes
    useEffect(() => {
        if (image) {
            // Set stage size to actual image dimensions
            setStageSize({ width: image.width, height: image.height });
            console.log(`Stage size set to image dimensions: ${image.width}x${image.height}`);
        } else {
            setStageSize({ width: 0, height: 0 }); // Reset if no image
        }
    }, [image]);

    // Handler to deselect rectangles when clicking on stage/background
    const checkDeselect = useCallback((e) => {
        // Check if the click target is the Stage itself
        // Access stage instance via ref passed from App
        const clickedOnStage = e.target === stageRef?.current;
        if (clickedOnStage) {
            onRectSelect(null);
        }
        // Note: Checking for e.target.hasName('backgroundImage') might be unreliable
        // if the image isn't the direct target. Clicking the Stage is safer.
    }, [stageRef, onRectSelect]); // Add dependencies


    // Display loading or prompt if image not ready
    if (!image && imageSrc) {
         return <div className="p-3 text-center text-muted">Loading image...</div>;
    }
     if (!imageSrc) {
         return <div className="p-3 text-center text-muted">Please upload an image.</div>;
     }
     // Check if stage size is calculated
     if (stageSize.width === 0 || stageSize.height === 0) {
          return <div className="p-3 text-center text-muted">Calculating canvas size...</div>;
     }

    return (
        // Outer div controls display size and scrolling via CSS (.canvas-panel)
        <div style={{ width: '100%', height: '100%', overflow: 'auto', background: '#ddd', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            {/* Stage dimensions match the image */}
            <Stage
                width={stageSize.width}
                height={stageSize.height}
                ref={stageRef} // Assign the ref passed from App.jsx
                onMouseDown={checkDeselect}
                onTouchStart={checkDeselect}
                // No DnD handlers needed on Stage itself if handled on outer div
            >
                <Layer>
                    {image && (
                        <KonvaImage
                            image={image}
                            width={stageSize.width}
                            height={stageSize.height}
                            // name="backgroundImage" // Name is less critical if checkDeselect uses stage ref
                        />
                    )}
                    {rectangles.map((rect) => (
                        <CanvasRectangle
                            key={rect.id}
                            shapeProps={rect}
                            isSelected={rect.id === selectedRectId}
                            onSelect={() => onRectSelect(rect.id)}
                            // Pass the memoized updateRectangle from App.jsx via onRectChange prop
                            onChange={(newAttrs) => onRectChange(rect.id, newAttrs)}
                            categoryColor={getCategoryColor(rect.categoryId, categories)}
                            stageSize={stageSize} // Pass stageSize for bounds checking
                        />
                    ))}
                </Layer>
            </Stage>
        </div>
    );
};

export default CanvasComponent;