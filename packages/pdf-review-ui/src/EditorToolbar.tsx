import { EDITOR_TOOLS, EDITOR_TOOL_LABELS, type EditorTool } from './dsaTypes';

interface EditorToolbarProps {
  activeTool: EditorTool;
  onToolChange: (tool: EditorTool) => void;
  disabled?: boolean;
}

const toolIcons: Record<EditorTool, string> = {
  'select': '↖',
  'draw': '▭',
  'split': '✂',
  'merge': '⇄',
  'delete': '🗑',
  'edit-text': '✎',
  'ai-chat': '🤖',
};

export default function EditorToolbar({ activeTool, onToolChange, disabled }: EditorToolbarProps) {
  return (
    <div className="editor-toolbar">
      {EDITOR_TOOLS.map((tool) => (
        <button
          key={tool}
          className={`tool-btn ${activeTool === tool ? 'active' : ''}`}
          onClick={() => onToolChange(tool)}
          disabled={disabled}
          title={EDITOR_TOOL_LABELS[tool]}
        >
          <span className="tool-icon">{toolIcons[tool]}</span>
          <span className="tool-label">{EDITOR_TOOL_LABELS[tool]}</span>
        </button>
      ))}
    </div>
  );
}
