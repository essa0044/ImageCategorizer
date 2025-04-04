import React, { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Transformer } from 'react-konva';
import useImage from 'use-image';

// Helper to find category color
const getCategoryColor = (categoryId, categories, defaultColor = 'grey') => {
    const category = categories.find(cat => cat.id === categoryId);
    return category ? category.color : defaultColor;
};

const CanvasRectangle = ({ shapeProps, isSelected, onSelect, onChange, categoryColor }) => {
    const shapeRef = useRef();
    const trRef = useRef();

    useEffect(() => {
        if (isSelected && trRef.current) {
            // We need to attach transformer manually
            trRef.current.nodes([shapeRef.current]);
            trRef.current.getLayer().batchDraw();
        }
    }, [isSelected]);

    return (
        <React.Fragment>
            <Rect
                onClick={onSelect}
                onTap={onSelect}
                ref={shapeRef}
                {...shapeProps}
                fill={categoryColor} // Use category color
                opacity={0.6} // Make it slightly transparent
                draggable
                onDragEnd={(e) => {
                    onChange({
                        ...shapeProps,
                        x: e.target.x(),
                        y: e.target.y(),
                    });
                }}
                onTransformEnd={(e) => {
                    // Transformer is changing scale and position, need to update width/height
                    const node = shapeRef.current;
                    const scaleX = node.scaleX();
                    const scaleY = node.scaleY();

                    // Reset scale to avoid compounding transforms
                    node.scaleX(1);
                    node.scaleY(1);
                    onChange({
                        ...shapeProps,
                        x: node.x(),
                        y: node.y(),
                        // Prevent negative width/height
                        width: Math.max(5, node.width() * scaleX),
                        height: Math.max(5, node.height() * scaleY),
                    });
                }}
            />
            {isSelected && (
                <Transformer
                    ref={trRef}
                    boundBoxFunc={(oldBox, newBox) => {
                        // Limit resize minimum size
                        if (newBox.width < 5 || newBox.height < 5) {
                            return oldBox;
                        }
                        return newBox;
                    }}
                />
            )}
        </React.Fragment>
    );
};

const CanvasComponent = ({ imageSrc, rectangles, selectedRectId, onRectSelect, onRectChange, categories, stageRef }) => {
    const [image] = useImage(imageSrc, 'Anonymous'); // 'Anonymous' for CORS if image is on different domain
    // const stageRef = useRef(null);
    const [stageSize, setStageSize] = useState({ width: 800, height: 600}); // Default or calculated size

    // Adjust stage size based on container or image size
    useEffect(() => {
         // TODO: Better dynamic sizing based on parent container
         // const container = document.querySelector('.canvas-panel'); // Or pass ref
         // if (container) {
         //    setStageSize({ width: container.offsetWidth, height: container.offsetHeight });
         // }
         if (image) {
            // Option: Fit stage to image, potentially scaled
            const maxWidth = 800; // Max width for the canvas area
            const scale = Math.min(1, maxWidth / image.width);
            setStageSize({ width: image.width * scale, height: image.height * scale });
         }
    }, [image]);


    const checkDeselect = (e) => {
        // Deselect when clicking on empty area (stage or image)
        const clickedOnEmpty = e.target === e.target.getStage() || e.target.hasName('backgroundImage');
        if (clickedOnEmpty) {
            onRectSelect(null);
        }
    };


    return (
        <div style={{ border: '1px solid #ccc', width: '100%', height: '70vh', overflow: 'auto' }}>
            <Stage
                width={stageSize.width}
                height={stageSize.height}
                ref={stageRef}
                onMouseDown={checkDeselect}
                onTouchStart={checkDeselect}
            >
                <Layer>
                    {image && (
                        <KonvaImage
                            image={image}
                            width={stageSize.width}
                            height={stageSize.height}
                            name="backgroundImage" // Name for deselection logic
                        />
                    )}
                    {rectangles.map((rect) => (
                        <CanvasRectangle
                            key={rect.id}
                            shapeProps={rect}
                            isSelected={rect.id === selectedRectId}
                            onSelect={() => onRectSelect(rect.id)}
                            onChange={(newAttrs) => onRectChange(rect.id, newAttrs)}
                            categoryColor={getCategoryColor(rect.categoryId, categories)}
                        />
                    ))}
                </Layer>
            </Stage>
        </div>
    );
};

export default CanvasComponent;