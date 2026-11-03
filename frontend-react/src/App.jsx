
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./App.css";

function App() {
  const [code, setCode] = useState("");
  const [filename, setFilename] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const contents = await file.text();
      setCode(contents);
      setFilename(file.name);
      setResult("");
      setError("");
      setStatus(`Loaded ${file.name}`);
    } catch {
      setError("Unable to read selected file.");
    }
  }

  async function handleAnalyze() {
    if (!code.trim()) {
      setStatus("Please paste code or upload a source file.");
      return;
    }

    setLoading(true);
    setError("");
    setResult("");
    setStatus("Analyzing code...");

    try {
      const response = await fetch("/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: code.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || data.error || "Unknown server error"
        );
      }

      setResult(data.result || "No analysis returned.");
      setStatus("Analysis complete.");
    } catch (err) {
      setError(err.message);
      setStatus("Analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container">
      <header>
        <h1>Smart Code Checker</h1>
        <p>
          Upload or paste your source code to receive
          AI-powered code review and recommendations.
        </p>
      </header>

      <section className="card">
        <h2>Source Code</h2>

        <label htmlFor="fileInput">Upload a source file</label>
        <input
          id="fileInput"
          type="file"
          onChange={handleFileUpload}
        />

        {filename && <p className="filename">{filename}</p>}

        <label htmlFor="codeArea">Or paste your code</label>
        <textarea
          id="codeArea"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Paste your Python, JavaScript, or other source code here..."
          rows={16}
          spellCheck={false}
        />

        <button
          onClick={handleAnalyze}
          disabled={loading || !code.trim()}
        >
          {loading ? "Analyzing..." : "Analyze Code"}
        </button>

        {status && <p className="status">{status}</p>}
      </section>

      {error && (
        <section className="card error">
          <h2>Analysis Failed</h2>
          <p>{error}</p>
        </section>
      )}

      {result && (
        <section className="card results">
          <h2>Analysis Results</h2>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {result}
          </ReactMarkdown>
        </section>
      )}
    </main>
  );
}

export default App;
