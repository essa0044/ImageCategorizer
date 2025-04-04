// frontend/src/App.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import UploadControls from './components/UploadControls.jsx';
import CategoryList from './components/CategoryList';
import CanvasComponent from './components/CanvasComponent';
import DetailsPanel from './components/DetailsPanel';
import { v4 as uuidv4 } from 'uuid'; // Import uuid
import './App.css';

function App() {
    // --- State ---
    const [uploadedImage, setUploadedImage] = useState(null); // URL to temp processed image
    const [originalFilename, setOriginalFilename] = useState(''); // Store original filename
    const [categories, setCategories] = useState([]);
    const [rectangles, setRectangles] = useState([]);
    const [selectedRectId, setSelectedRectId] = useState(null);
    const [autoClassified, setAutoClassified] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [classifyOnUploadFlag, setClassifyOnUploadFlag] = useState(false);
    // --- Refs ---
    const stageRef = useRef(null); // Renamed for clarity

    // --- Effects ---
    // Fetch categories
    useEffect(() => {
        setIsLoading(true);
        axios.get('/api/categories')
            .then(response => setCategories(response.data))
            .catch(error => console.error('Error fetching categories:', error))
            .finally(() => setIsLoading(false));
    }, []); // Correct: Run once

    // Define handleAutoClassify (memoized) - needed by the next useEffect
     const handleAutoClassify = useCallback((imageUrlToClassify) => {
        if (!imageUrlToClassify) return;
        setIsLoading(true);
        console.log("Triggering auto-classify for:", imageUrlToClassify);
        axios.post('/api/auto-classify', { image_url: imageUrlToClassify })
            .then(response => {
                const backendRects = response.data.rectangles || [];
                // Ensure frontend IDs are strings and unique using UUID
                const frontendRects = backendRects.map(r => ({ ...r, id: `rect-${uuidv4()}` }));
                setRectangles(frontendRects);
                setAutoClassified(response.data.autoClassified || false);
            })
            .catch(error => {
                console.error('Error during auto-classification:', error);
            })
            .finally(() => setIsLoading(false));
      // Correct dependencies
    }, [setIsLoading, setRectangles, setAutoClassified]);

    // Trigger Auto-Classify
    useEffect(() => {
        if (uploadedImage && classifyOnUploadFlag) {
             handleAutoClassify(uploadedImage);
            setClassifyOnUploadFlag(false);
        }
      // Correct dependencies
    }, [uploadedImage, classifyOnUploadFlag, handleAutoClassify, setClassifyOnUploadFlag]);

    // --- Callback Handlers ---
    const handleFileUpload = useCallback((file, classifyOnUpload) => {
        setIsLoading(true);
        setClassifyOnUploadFlag(classifyOnUpload);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('classifyOnUpload', classifyOnUpload);

        axios.post('/api/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
            .then(response => {
                console.log('Upload response:', response.data);
                setUploadedImage(response.data.image_url);
                setOriginalFilename(response.data.original_filename || file.name);
                setRectangles([]);
                setSelectedRectId(null);
                setAutoClassified(false);
            })
            .catch(error => {
                console.error('Error uploading file:', error);
                setClassifyOnUploadFlag(false);
            })
            .finally(() => setIsLoading(false));
      // Correct dependencies
    }, [setIsLoading, setClassifyOnUploadFlag, setUploadedImage, setOriginalFilename, setRectangles, setSelectedRectId, setAutoClassified]);


    // Add rectangle (used by DnD)
    const addRectangle = useCallback((newRect) => {
        // Ensure ID is generated here using uuid
        const rectWithId = {
            ...newRect,
            id: `rect-${uuidv4()}`
        };
         if (rectWithId.x == null || rectWithId.y == null) { // Basic check
             console.error("Attempted to add rectangle with invalid position:", rectWithId);
             return;
         }
        setRectangles(prev => [...prev, rectWithId]);
      // Correct dependency
    }, [setRectangles]);

    // Update rectangle (used by CanvasComponent onChange)
    const updateRectangle = useCallback((id, updatedAttrs) => {
        const targetId = String(id);
        setRectangles(prev =>
            prev.map(rect =>
                String(rect.id) === targetId ? { ...rect, ...updatedAttrs } : rect
            )
        );
     // Correct dependency
    }, [setRectangles]);


    const handleRectangleSelect = useCallback((id) => {
        setSelectedRectId(id);
     // Correct dependency
    }, [setSelectedRectId]);


    const getSelectedRectangle = () => {
        // Find logic is fine, no useCallback needed unless complex
        return rectangles.find(rect => rect.id === selectedRectId);
    };


    const changeRectangleCategory = useCallback((rectId, newCategoryId) => {
        // Uses updateRectangle which is already memoized
        updateRectangle(rectId, { categoryId: newCategoryId });
    }, [updateRectangle]); // Correct dependency


    const changeRectangleHierarchy = useCallback((rectId, newHierarchy) => {
        // Uses updateRectangle which is already memoized
        updateRectangle(rectId, { hierarchy: newHierarchy });
    }, [updateRectangle]); // Correct dependency


     // Submit Handler
     const handleSubmit = useCallback(() => {
         if (!uploadedImage || rectangles.length === 0) {
             alert("Please load an image and add at least one rectangle before submitting.");
             return;
         }
         setIsLoading(true);
         // Prepare data, ensuring frontend IDs are not sent if backend doesn't need them
         const rectanglesToSubmit = rectangles.map(({ id, ...rest }) => rest); // Exclude frontend temporary ID

         const dataToSubmit = {
             image_url: uploadedImage,
             original_filename: originalFilename,
             rectangles: rectanglesToSubmit, // Send data without temporary frontend ID
         };
         console.log("Submitting data:", dataToSubmit);

         axios.post('/api/submit', dataToSubmit)
           .then(response => {
             console.log("Submission successful:", response.data);
             alert(`Classification submitted successfully! Exam ID: ${response.data.examId}`);
             // Reset state after successful submission
             setUploadedImage(null);
             setRectangles([]);
             setSelectedRectId(null);
             setAutoClassified(false);
             setOriginalFilename('');
           })
           .catch(error => {
             console.error("Error submitting classification:", error.response ? error.response.data : error.message);
             alert(`Submission failed: ${error.response ? error.response.data.error : error.message}`);
           })
           .finally(() => setIsLoading(false));
     // Correct dependencies needed by the function
     }, [uploadedImage, originalFilename, rectangles, setIsLoading, setUploadedImage, setRectangles, setSelectedRectId, setAutoClassified, setOriginalFilename]);


    // --- Drag and Drop Handlers (Kept as user confirmed working) ---
    const handleDragCategoryStart = (e, category) => {
        // Using application/json is slightly better than generic 'category'
        e.dataTransfer.setData('application/json', JSON.stringify(category));
        e.dataTransfer.effectAllowed = 'copy';
    };

    const handleCanvasDrop = (e) => {
        e.preventDefault();
        const categoryString = e.dataTransfer.getData('application/json'); // Use correct type
        if (!categoryString) return;

        try {
             const category = JSON.parse(categoryString);
             if (!stageRef.current) {
                 console.warn("Konva stage ref not available for drop");
                 return;
             }
             const stage = stageRef.current; // Direct access via ref
             const pos = stage.getPointerPosition();

             if (pos && category) {
                 addRectangle({ // Let addRectangle handle the ID
                     x: pos.x - 50, y: pos.y - 25, width: 100, height: 50,
                     categoryId: category.id,
                     hierarchy: '',
                 });
             }
        } catch (err) {
             console.error("Error handling canvas drop:", err);
        }
    };

    const handleCanvasDragOver = (e) => {
        e.preventDefault();
        // Optional: Set dropEffect for better cursor feedback
        e.dataTransfer.dropEffect = "copy";
    };
    // --- End Drag and Drop ---

    // --- JSX Return ---
    return (
        // Removed ref from outer div, pass stageRef to CanvasComponent
        <div className="container-fluid mt-3">
            <h1>Exam Classification Tool</h1>
            <hr />

            <UploadControls
                onFileUpload={handleFileUpload}
                onAutoClassify={() => handleAutoClassify(uploadedImage)}
                onSubmit={handleSubmit}
                showAutoClassifyButton={uploadedImage && !autoClassified}
                isLoading={isLoading}
                // No onAddDefaultRect needed
            />

            <hr />

            {isLoading && <div className="alert alert-info">Loading...</div>}

            {/* Layout */}
            <div className="row g-3 main-layout-row"> {/* Use class from App.css */}
                {/* Left Panel */}
                <div className="col-md-2 category-panel">
                    <h2>Categories</h2>
                    <CategoryList
                        categories={categories}
                        onDragStart={handleDragCategoryStart} // Keep DnD handler
                    />
                </div>

                {/* Center Panel */}
                {/* Add DnD Handlers here as user confirmed working */}
                <div className="col-md-8 canvas-panel"
                    onDrop={handleCanvasDrop}
                    onDragOver={handleCanvasDragOver}>
                    <CanvasComponent
                        stageRef={stageRef} // Pass the ref down
                        imageSrc={uploadedImage}
                        rectangles={rectangles}
                        selectedRectId={selectedRectId}
                        onRectSelect={handleRectangleSelect}
                        onRectChange={updateRectangle} // Connects to the memoized updateRectangle
                        categories={categories}
                    />
                </div>

                {/* Right Panel */}
                <div className="col-md-2 details-panel">
                     {selectedRectId && getSelectedRectangle() && (
                        <DetailsPanel
                            rectangle={getSelectedRectangle()}
                            categories={categories}
                            onChangeCategory={changeRectangleCategory} // Connects to the memoized changeRectangleCategory
                            onChangeHierarchy={changeRectangleHierarchy} // Connects to the memoized changeRectangleHierarchy
                        />
                     )}
                </div>
            </div>
        </div>
    );
}

export default App;