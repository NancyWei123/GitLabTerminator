import { useState } from "react";
import "./App.css";
import {
  getProjectId,
  getRepositoryTree,
  getRawFile,
  createGitLabIssue,
} from "./api/gitlab";
import { askGemini } from "./api/gemini";

type SuggestedIssue = {
  title: string;
  description: string;
};

type AnalysedFile = {
  path: string;
  content: string;
};

function App() {
  const [repoUrl, setRepoUrl] = useState("");
  const [gitlabToken, setGitlabToken] = useState(() => {
    return localStorage.getItem("gitlabToken") || "";
  });
  const [geminiKey, setGeminiKey] = useState(() => {
    return localStorage.getItem("geminiKey") || "";
  });
  const [loading, setLoading] = useState(false);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [explanation, setExplanation] = useState("");
  const [issues, setIssues] = useState<SuggestedIssue[]>([]);

  const parseIssues = (text: string): SuggestedIssue[] => {
    const cleaned = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    return JSON.parse(cleaned);
  };

  const analyseRepo = async () => {
    if (!repoUrl.trim() || !gitlabToken.trim() || !geminiKey.trim()) {
      alert("Please enter the GitLab repo URL, GitLab token, and Gemini API key.");
      return;
    }

    try {
      setLoading(true);
      setExplanation("");
      setIssues([]);

      const project = await getProjectId(repoUrl, gitlabToken);
      setProjectId(project.id);

      const tree = await getRepositoryTree(project.id, gitlabToken);

      const importantFiles = tree
        .filter((item) => item.type === "blob")
        .filter((item) => {
          const path = item.path.toLowerCase();

          return (
            path === "readme.md" ||
            path === "package.json" ||
            path === "requirements.txt" ||
            path === "pom.xml" ||
            path === "build.gradle" ||
            path.startsWith("src/") ||
            path.startsWith("app/")
          );
        })
        .slice(0, 12);

      const files: AnalysedFile[] = [];

      for (const file of importantFiles) {
        const content = await getRawFile(
          project.id,
          file.path,
          gitlabToken,
          project.default_branch || "main"
        );

        if (content.trim()) {
          files.push({
            path: file.path,
            content: content.slice(0, 5000),
          });
        }
      }

      const prompt = `
You are an AI GitLab repository assistant.

Analyse this repository and return:

1. Simple project explanation
2. Tech stack
3. Main folder/file structure
4. How a beginner can run this project
5. 5 suggested GitLab issues
6. For each issue:
   - title
   - why it matters
   - how to fix it
   - difficulty: easy / medium / hard

Repository name:
${project.name}

Repository description:
${project.description || "No description"}

Files:
${files
  .map(
    (file) => `
--- FILE: ${file.path} ---
${file.content}
`
  )
  .join("\n")}
`;

      const result = await askGemini(geminiKey, prompt);
      setExplanation(result);

      const issuePrompt = `
Based on this repository analysis, create exactly 5 GitLab issues.

Return ONLY valid JSON.
No markdown.

Format:
[
  {
    "title": "Issue title",
    "description": "Detailed issue description with fix steps"
  }
]

Repository analysis:
${result}
`;

      const issueJson = await askGemini(geminiKey, issuePrompt);
      setIssues(parseIssues(issueJson));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateIssue = async (issue: SuggestedIssue) => {
    if (!projectId) return;

    try {
      await createGitLabIssue(
        projectId,
        gitlabToken,
        issue.title,
        issue.description
      );

      alert("Issue created in GitLab!");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to create issue.");
    }
  };

  return (
    <main className="app">
      <section className="hero-section">
        <div className="hero-badge">AI GitLab Repository Assistant</div>

        <h1>
          Understand any GitLab repo.
          <span> Create better issues faster.</span>
        </h1>

        <p className="hero-text">
          Paste a GitLab repository link, then GitTerminator will explain the
          project, detect the tech stack, and suggest beginner-friendly issues
          with fix steps.
        </p>

        <div className="hero-stats">
          <div>
            <strong>01</strong>
            <span>Read repo files</span>
          </div>
          <div>
            <strong>02</strong>
            <span>Explain structure</span>
          </div>
          <div>
            <strong>03</strong>
            <span>Create GitLab issues</span>
          </div>
        </div>
      </section>

      <section className="content-grid">
        <div className="form-card">
          <div className="card-header">
            <div>
              <p className="eyebrow">Repository input</p>
              <h2>Analyse a project</h2>
            </div>
            <div className="status-pill">
              {loading ? "Running" : projectId ? "Ready" : "Idle"}
            </div>
          </div>

          <label className="input-group">
            <span>GitLab repository URL</span>
            <input
              placeholder="https://gitlab.com/group/project"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
            />
          </label>

          <label className="input-group">
            <span>GitLab token</span>
            <input
              placeholder="Paste your GitLab private token"
              type="password"
              value={gitlabToken}
              onChange={(e) => {
                setGitlabToken(e.target.value);
                localStorage.setItem("gitlabToken", e.target.value);
              }}
            />
          </label>

          <label className="input-group">
            <span>Gemini API key</span>
            <input
              placeholder="Paste your Gemini API key"
              type="password"
              value={geminiKey}
              onChange={(e) => {
                setGeminiKey(e.target.value);
                localStorage.setItem("geminiKey", e.target.value);
              }}
            />
          </label>

          <button
            className="primary-button"
            onClick={analyseRepo}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner" />
                Analysing repository...
              </>
            ) : (
              "Analyse Repository"
            )}
          </button>

          <p className="helper-text">
            Tip: use a private token with the minimum permissions required to
            read the repository and create issues.
          </p>
        </div>

        <aside className="preview-card">
          <p className="eyebrow">What you get</p>
          <h2>Clean explanation + actionable issues</h2>

          <div className="feature-list">
            <div>
              <span className="feature-icon">📘</span>
              <p>Beginner-friendly project summary</p>
            </div>
            <div>
              <span className="feature-icon">🧩</span>
              <p>Tech stack and file structure overview</p>
            </div>
            <div>
              <span className="feature-icon">✅</span>
              <p>Five fixable GitLab issue suggestions</p>
            </div>
          </div>
        </aside>
      </section>

      {explanation && (
        <section className="result-section">
          <div className="section-title">
            <p className="eyebrow">AI result</p>
            <h2>Repository Explanation</h2>
          </div>

          <pre className="analysis-box">{explanation}</pre>
        </section>
      )}

      {issues.length > 0 && (
        <section className="result-section">
          <div className="section-title">
            <p className="eyebrow">Suggested work</p>
            <h2>GitLab Issues</h2>
          </div>

          <div className="issue-grid">
            {issues.map((issue, index) => (
              <article className="issue-card" key={`${issue.title}-${index}`}>
                <div className="issue-number">
                  Issue {String(index + 1).padStart(2, "0")}
                </div>

                <h3>{issue.title}</h3>
                <p>{issue.description}</p>

                <button
                  className="secondary-button"
                  onClick={() => handleCreateIssue(issue)}
                >
                  Create Issue in GitLab
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

export default App;
