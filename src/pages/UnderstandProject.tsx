import { useState } from "react";
import "../App.css";
import {
  getProjectId,
  getRepositoryTree,
  getRawFile,
  createGitLabIssue,
} from "../api/gitlab";
import { askGemini } from "../api/gemini";

type SuggestedIssue = {
  title: string;
  description: string;
};

type AnalysedFile = {
  path: string;
  content: string;
};

type LanguageOption = {
  label: string;
  value: string;
  instruction: string;
};

const languageOptions: LanguageOption[] = [
  {
    label: "English",
    value: "English",
    instruction: "Write the whole answer in clear beginner-friendly English.",
  },
  {
    label: "中文",
    value: "Chinese",
    instruction: "请用清楚、适合初学者理解的中文回答。",
  }
];

const levelDescriptions: Record<number, string> = {
  1: "Very beginner. Explain like the user is new to programming.",
  2: "Beginner. Explain basic concepts and avoid advanced jargon.",
  3: "Intermediate. Use normal developer terms, but still explain clearly.",
  4: "Advanced. Include architecture, trade-offs, and implementation details.",
  5: "Expert. Use deep technical explanation, architecture reasoning, and improvement strategy.",
};

function App() {
  const [repoUrl, setRepoUrl] = useState("");
  const [gitlabToken, setGitlabToken] = useState(() => {
    return localStorage.getItem("gitlabToken") || "";
  });
  const [geminiKey, setGeminiKey] = useState(() => {
    return localStorage.getItem("geminiKey") || "";
  });

  const [language, setLanguage] = useState(() => {
    return localStorage.getItem("explanationLanguage") || "English";
  });
  const [techLevel, setTechLevel] = useState(() => {
    return Number(localStorage.getItem("technologyLevel")) || 2;
  });

  const [loading, setLoading] = useState(false);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [explanation, setExplanation] = useState("");
  const [issues, setIssues] = useState<SuggestedIssue[]>([]);

  const selectedLanguage =
    languageOptions.find((option) => option.value === language) ||
    languageOptions[0];

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
            path === "vite.config.ts" ||
            path === "vite.config.js" ||
            path === "tsconfig.json" ||
            path.startsWith("src/") ||
            path.startsWith("app/") ||
            path.startsWith("pages/") ||
            path.startsWith("components/")
          );
        })
        .slice(0, 14);

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
You are an AI GitLab repository teacher.

The user selected this output language:
${selectedLanguage.value}

Language instruction:
${selectedLanguage.instruction}

The user selected this technology explanation level:
${"⭐".repeat(techLevel)} (${techLevel}/5)

Technology level instruction:
${levelDescriptions[techLevel]}

Analyse this repository and return the answer in the selected language.

Please include:

1. Project summary
   - Explain what this project does.
   - Explain who may use it.

2. Technology level rating
   - Give a rating from 1 to 5 stars.
   - Format: Technology Level: ${"⭐".repeat(techLevel)} (${techLevel}/5)
   - Explain why this project matches this level.

3. Tech stack
   - List the main technologies.
   - Explain the role of each technology.

4. Main folder/file structure
   - Explain the important files and folders.

5. Beginner learning path
   - Tell the user what to learn first.
   - Give a simple order to read the project.

6. How to run this project
   - Give clear setup steps.
   - Mention possible commands if they can be inferred.

7. 5 suggested GitLab issues
   - Each issue must include:
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
Use this language for the issue title and description:
${selectedLanguage.value}

Language instruction:
${selectedLanguage.instruction}

Technology explanation level:
${techLevel}/5 - ${levelDescriptions[techLevel]}

Format:
[
  {
    "title": "Issue title",
    "description": "Detailed issue description with why it matters, fix steps, and difficulty"
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
          <span> Learn at your level.</span>
        </h1>

        <p className="hero-text">
          Paste a GitLab repository link, choose your explanation language and
          technology level, then GitLabTerminator will explain the project and
          suggest useful issues.
        </p>

        <div className="hero-stats">
          <div>
            <strong>01</strong>
            <span>Read repo files</span>
          </div>
          <div>
            <strong>02</strong>
            <span>Explain in your language</span>
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

          <div className="settings-grid">
            <label className="input-group">
              <span>Explanation language</span>
              <select
                value={language}
                onChange={(e) => {
                  setLanguage(e.target.value);
                  localStorage.setItem("explanationLanguage", e.target.value);
                }}
              >
                {languageOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="input-group">
              <span>Technology level</span>
              <div className="star-selector" aria-label="Technology level">
                {[1, 2, 3, 4, 5].map((level) => (
                  <button
                    key={level}
                    type="button"
                    className={level <= techLevel ? "star active" : "star"}
                    onClick={() => {
                      setTechLevel(level);
                      localStorage.setItem("technologyLevel", String(level));
                    }}
                    aria-label={`Technology level ${level}`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <p className="level-helper">
                {techLevel}/5 · {levelDescriptions[techLevel]}
              </p>
            </div>
          </div>

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
            Tip: the GitLab token and Gemini key are saved in your browser, so
            you do not need to enter them every time.
          </p>
        </div>

        <aside className="preview-card">
          <p className="eyebrow">What you get</p>
          <h2>Personalised explanation + actionable issues</h2>

          <div className="feature-list">
            <div>
              <span className="feature-icon">🌐</span>
              <p>Choose the language for the project explanation</p>
            </div>
            <div>
              <span className="feature-icon">⭐</span>
              <p>Choose 1–5 stars for the technology level</p>
            </div>
            <div>
              <span className="feature-icon">✅</span>
              <p>Get five GitLab issues with clear fix steps</p>
            </div>
          </div>
        </aside>
      </section>

      {explanation && (
        <section className="result-section">
          <div className="section-title">
            <div>
              <p className="eyebrow">AI result</p>
              <h2>Repository Explanation</h2>
            </div>

            <div className="result-tags">
              <span>{selectedLanguage.label}</span>
              <span>{"⭐".repeat(techLevel)} {techLevel}/5</span>
            </div>
          </div>

          <pre className="analysis-box">{explanation}</pre>
        </section>
      )}

      {issues.length > 0 && (
        <section className="result-section">
          <div className="section-title">
            <div>
              <p className="eyebrow">Suggested work</p>
              <h2>GitLab Issues</h2>
            </div>
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
