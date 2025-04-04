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
            // Attach transformer manually
            trRef.current.nodes([shapeRef.current]);
            trRef.current.getLayer().batchDraw();
        }
    }, [isSelected]);

    return (
        <React.Fragment>
            <Rect
                onClick={() => {
                    onSelect();
                    console.log(`📍 Selected Rectangle: ${shapeProps.id}, X: ${shapeProps.x}, Y: ${shapeProps.y}, Width: ${shapeProps.width}, Height: ${shapeProps.height}`);
                }}
                onTap={() => {
                    onSelect();
                    console.log(`📍 Selected Rectangle: ${shapeProps.id}, X: ${shapeProps.x}, Y: ${shapeProps.y}, Width: ${shapeProps.width}, Height: ${shapeProps.height}`);
                }}
                ref={shapeRef}
                {...shapeProps}
                fill={categoryColor}
                opacity={0.6} 
                draggable
                onDragEnd={(e) => {
                    const updatedShape = {
                        ...shapeProps,
                        x: e.target.x(),
                        y: e.target.y(),
                    };
                    onChange(updatedShape);
                    console.log(`Moved Rectangle: ${updatedShape.id}, X: ${updatedShape.x}, Y: ${updatedShape.y}`);
                }}
                onTransformEnd={(e) => {
                    const node = shapeRef.current;
                    const scaleX = node.scaleX();
                    const scaleY = node.scaleY();

                    // Reset scale
                    node.scaleX(1);
                    node.scaleY(1);

                    const updatedShape = {
                        ...shapeProps,
                        x: node.x(),
                        y: node.y(),
                        width: Math.max(5, node.width() * scaleX),
                        height: Math.max(5, node.height() * scaleY),
                    };
                    onChange(updatedShape);
                    console.log(`Resized Rectangle: ${updatedShape.id}, X: ${updatedShape.x}, Y: ${updatedShape.y}, Width: ${updatedShape.width}, Height: ${updatedShape.height}`);
                }}
            />
            {isSelected && (
                <Transformer
                    ref={trRef}
                    boundBoxFunc={(oldBox, newBox) => {
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
    const [image] = useImage(imageSrc, 'Anonymous');
    const [stageSize, setStageSize] = useState({ width: 800, height: 600 });

    useEffect(() => {
        if (image) {
            const maxWidth = 800;
            const scale = Math.min(1, maxWidth / image.width);
            setStageSize({ width: image.width * scale, height: image.height * scale });
        }
    }, [image]);

    const checkDeselect = (e) => {
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
                            name="backgroundImage"
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
