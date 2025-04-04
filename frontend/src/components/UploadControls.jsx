import React, { useState, useRef } from 'react';

function UploadControls({ onFileUpload, onAutoClassify, onSubmit, showAutoClassifyButton, isLoading }) {
    const [selectedFile, setSelectedFile] = useState(null);
    const [classifyOnUpload, setClassifyOnUpload] = useState(false);
    const fileInputRef = useRef(null);

    const handleFileChange = (event) => {
        setSelectedFile(event.target.files[0]);
    };

    const handleUploadClick = () => {
        if (selectedFile) {
            onFileUpload(selectedFile, classifyOnUpload);
        } else {
            alert('Please select a file first.');
        }
    };

    return (
        <div className="mb-3 p-3 border rounded">
            <div className="row g-2 align-items-end">
                <div className="col-auto">
                    <label htmlFor="formFile" className="form-label">Upload PDF/Image</label>
                    <input
                        className="form-control"
                        type="file"
                        id="formFile"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept=".pdf,.png,.jpg,.jpeg"
                        disabled={isLoading}
                    />
                </div>
                <div className="col-auto d-flex align-items-center pt-3">
                    <div className="form-check">
                        <input
                            className="form-check-input"
                            type="checkbox"
                            id="classifyOnUploadCheck"
                            checked={classifyOnUpload}
                            onChange={(e) => setClassifyOnUpload(e.target.checked)}
                            disabled={isLoading}
                        />
                        <label className="form-check-label" htmlFor="classifyOnUploadCheck">
                            Classify on Upload
                        </label>
                    </div>
                </div>
                 <div className="col-auto">
                     <button
                         className="btn btn-primary"
                         onClick={handleUploadClick}
                         disabled={!selectedFile || isLoading}
                     >
                         {isLoading ? 'Uploading...' : 'Load Image'}
                     </button>
                </div>
                {showAutoClassifyButton && (
                    <div className="col-auto">
                        <button
                            className="btn btn-secondary"
                            onClick={onAutoClassify}
                            disabled={isLoading}
                        >
                            {isLoading ? 'Classifying...' : 'Auto Classify'}
                        </button>
                    </div>
                )}
                <div className="col-auto">
                     <button
                         className="btn btn-success"
                         onClick={onSubmit}
                         disabled={isLoading} // Disable when loading or maybe if no rectangles exist?
                     >
                         {isLoading ? 'Submitting...' : 'Submit Classification'}
                     </button>
                </div>
            </div>
        </div>
    );
}

export default UploadControls;