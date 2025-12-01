// Enhanced document preview helper
// Supports: code files, config files, CSV, logs, PDF

// File extension to language mapping for syntax highlighting
const FILE_EXTENSIONS = {
    // Code files
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'py': 'python',
    'java': 'java',
    'c': 'c',
    'cpp': 'cpp',
    'h': 'c',
    'hpp': 'cpp',
    'cs': 'csharp',
    'go': 'go',
    'rs': 'rust',
    'php': 'php',
    'rb': 'ruby',
    'swift': 'swift',
    'kt': 'kotlin',
    'html': 'html',
    'htm': 'html',
    'css': 'css',
    'scss': 'scss',
    'sass': 'sass',
    'json': 'json',
    'xml': 'xml',
    'yaml': 'yaml',
    'yml': 'yaml',
    'sql': 'sql',
    'sh': 'bash',
    'bash': 'bash',

    // Config files
    'env': 'bash',
    'ini': 'ini',
    'conf': 'nginx',
    'config': 'xml',
    'gitignore': 'bash',
    'dockerignore': 'bash',
    'properties': 'properties',

    // Text files
    'txt': 'plaintext',
    'md': 'markdown',
    'markdown': 'markdown',
    'log': 'plaintext',
    'csv': 'csv',
    'rtf': 'plaintext'
};

// Check if file can be previewed as text/code
window.canPreviewAsText = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    return FILE_EXTENSIONS.hasOwnProperty(ext) || ext === 'pdf';
};

// Get language for syntax highlighting
window.getLanguageForFile = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    return FILE_EXTENSIONS[ext] || 'plaintext';
};

// Parse CSV and render as HTML table
window.parseCSV = (text) => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return '<p>Empty CSV file</p>';

    const rows = lines.map(line => {
        // Simple CSV parsing (handles basic cases)
        return line.split(',').map(cell => cell.trim());
    });

    let html = '<table style="width: 100%; border-collapse: collapse; background: white; color: #333;">';

    // Header row
    html += '<thead><tr>';
    rows[0].forEach(cell => {
        html += `<th style="border: 1px solid #ddd; padding: 8px; background: #f2f2f2; font-weight: bold;">${escapeHtml(cell)}</th>`;
    });
    html += '</tr></thead>';

    // Data rows
    html += '<tbody>';
    for (let i = 1; i < rows.length; i++) {
        html += '<tr>';
        rows[i].forEach(cell => {
            html += `<td style="border: 1px solid #ddd; padding: 8px;">${escapeHtml(cell)}</td>`;
        });
        html += '</tr>';
    }
    html += '</tbody></table>';

    return html;
};

// Render PDF using PDF.js
window.renderPDF = async (url, container) => {
    try {
        // Set worker source
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        const loadingTask = pdfjsLib.getDocument(url);
        const pdf = await loadingTask.promise;

        container.innerHTML = '<div style="background: white; padding: 2rem; border-radius: 12px; max-width: 1400px; max-height: 80vh; overflow-y: auto;"><div id="pdf-container"></div></div>';
        const pdfContainer = document.getElementById('pdf-container');

        // Render all pages
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const scale = 1.5;
            const viewport = page.getViewport({ scale });

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            canvas.style.marginBottom = '20px';
            canvas.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';

            pdfContainer.appendChild(canvas);

            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;
        }
    } catch (error) {
        container.innerHTML = `<p style="color: white;">Failed to load PDF: ${error.message}</p>`;
    }
};
