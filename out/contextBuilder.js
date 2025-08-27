"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextBuilder = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
// import { WorkspaceContext } from './types'; // TODO: Use this type when implementing context features
class ContextBuilder {
    constructor() {
        this.MAX_CONTEXT_SIZE = 50 * 1024; // 50KB
        this.RELEVANT_EXTENSIONS = [
            '.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.cpp', '.c', '.cs',
            '.go', '.rs', '.php', '.rb', '.swift', '.kt', '.scala', '.dart',
            '.vue', '.svelte', '.html', '.css', '.scss', '.less', '.json',
            '.xml', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf',
            '.md', '.txt', '.sql', '.sh', '.bash', '.zsh', '.fish'
        ];
    }
    async buildContext() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new Error('No workspace folder found');
        }
        const workspacePath = workspaceFolder.uri.fsPath;
        const ignorePatterns = await this.readGitignore(workspacePath);
        const files = await this.walkWorkspace(workspacePath, ignorePatterns);
        const context = await this.buildContextFromFiles(files, workspacePath);
        return context;
    }
    async readGitignore(workspacePath) {
        const gitignorePath = path.join(workspacePath, '.gitignore');
        if (!fs.existsSync(gitignorePath)) {
            return [];
        }
        try {
            const content = fs.readFileSync(gitignorePath, 'utf8');
            return content.split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('#'));
        }
        catch (error) {
            console.error('Error reading .gitignore:', error);
            return [];
        }
    }
    async walkWorkspace(workspacePath, ignorePatterns) {
        const files = [];
        const walkDir = (dir) => {
            try {
                const items = fs.readdirSync(dir);
                for (const item of items) {
                    const fullPath = path.join(dir, item);
                    const relativePath = path.relative(workspacePath, fullPath);
                    // Skip if matches ignore patterns
                    if (this.shouldIgnore(relativePath, ignorePatterns)) {
                        continue;
                    }
                    const stat = fs.statSync(fullPath);
                    if (stat.isDirectory()) {
                        walkDir(fullPath);
                    }
                    else if (stat.isFile()) {
                        const ext = path.extname(item).toLowerCase();
                        if (this.RELEVANT_EXTENSIONS.includes(ext)) {
                            files.push(fullPath);
                        }
                    }
                }
            }
            catch (error) {
                console.error(`Error walking directory ${dir}:`, error);
            }
        };
        walkDir(workspacePath);
        return files;
    }
    shouldIgnore(filePath, ignorePatterns) {
        for (const pattern of ignorePatterns) {
            if (pattern.includes('*')) {
                // Simple glob pattern matching
                const regex = new RegExp(pattern.replace(/\*/g, '.*'));
                if (regex.test(filePath)) {
                    return true;
                }
            }
            else if (filePath.includes(pattern)) {
                return true;
            }
        }
        return false;
    }
    async buildContextFromFiles(files, workspacePath) {
        let context = '';
        let totalSize = 0;
        const includedFiles = [];
        // Sort files by relevance (prioritize source files)
        const sortedFiles = files.sort((a, b) => {
            const aExt = path.extname(a).toLowerCase();
            const bExt = path.extname(b).toLowerCase();
            const aScore = this.getFileRelevanceScore(aExt);
            const bScore = this.getFileRelevanceScore(bExt);
            return bScore - aScore;
        });
        for (const file of sortedFiles) {
            if (totalSize >= this.MAX_CONTEXT_SIZE) {
                break;
            }
            try {
                const content = fs.readFileSync(file, 'utf8');
                const relativePath = path.relative(workspacePath, file);
                // Skip if file is too large
                if (content.length > 5000) {
                    continue;
                }
                const fileContext = `\n## ${relativePath}\n\`\`\`${this.getLanguageFromExtension(path.extname(file))}\n${content}\n\`\`\`\n`;
                if (totalSize + fileContext.length <= this.MAX_CONTEXT_SIZE) {
                    context += fileContext;
                    totalSize += fileContext.length;
                    includedFiles.push(relativePath);
                }
            }
            catch (error) {
                console.error(`Error reading file ${file}:`, error);
            }
        }
        // Add file structure summary
        const structure = this.buildFileStructure(files, workspacePath);
        context = `# Workspace Structure\n${structure}\n\n# Source Files\n${context}`;
        return context;
    }
    getFileRelevanceScore(extension) {
        const scores = {
            '.ts': 10, '.js': 9, '.tsx': 10, '.jsx': 9,
            '.py': 8, '.java': 8, '.cpp': 8, '.c': 7,
            '.go': 8, '.rs': 8, '.php': 7, '.rb': 7,
            '.vue': 9, '.svelte': 9, '.html': 6, '.css': 5,
            '.json': 6, '.xml': 5, '.yaml': 6, '.yml': 6,
            '.md': 4, '.txt': 3, '.sql': 6, '.sh': 5
        };
        return scores[extension] || 1;
    }
    getLanguageFromExtension(extension) {
        const languageMap = {
            '.ts': 'typescript', '.js': 'javascript', '.tsx': 'typescript', '.jsx': 'javascript',
            '.py': 'python', '.java': 'java', '.cpp': 'cpp', '.c': 'c',
            '.go': 'go', '.rs': 'rust', '.php': 'php', '.rb': 'ruby',
            '.vue': 'vue', '.svelte': 'svelte', '.html': 'html', '.css': 'css',
            '.json': 'json', '.xml': 'xml', '.yaml': 'yaml', '.yml': 'yaml',
            '.md': 'markdown', '.txt': 'text', '.sql': 'sql', '.sh': 'bash'
        };
        return languageMap[extension] || 'text';
    }
    buildFileStructure(files, workspacePath) {
        const structure = {};
        for (const file of files) {
            const relativePath = path.relative(workspacePath, file);
            const dir = path.dirname(relativePath);
            const filename = path.basename(relativePath);
            if (!structure[dir]) {
                structure[dir] = [];
            }
            structure[dir].push(filename);
        }
        let structureText = '';
        for (const [dir, files] of Object.entries(structure)) {
            structureText += `\n${dir}/\n`;
            for (const file of files) {
                structureText += `  ${file}\n`;
            }
        }
        return structureText;
    }
}
exports.ContextBuilder = ContextBuilder;
//# sourceMappingURL=contextBuilder.js.map