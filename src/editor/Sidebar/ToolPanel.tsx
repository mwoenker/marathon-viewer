import { EditorState, ToolState, UpdateState } from '../state';

export interface ToolPanelProps {
    toolState: ToolState;
    updateState: UpdateState;
}

const tools = [
    {
        name: 'select',
        symbol: 'S'
    },
    {
        name: 'draw',
        symbol: 'D'
    },
] as const;

export function ToolPanel({ toolState, updateState }: ToolPanelProps): JSX.Element {
    console.log({toolState});
    return (
        <div className='toolPanel'>
            {tools.map(tool => {
                const className = tool.name === toolState.tool ? 'tool selected' : 'tool';
                return (
                    <div className={className} onClick={() => updateState({
                        type: 'selectTool',
                        tool: tool.name
                    })}
                    >
                        {tool.symbol}
                    </div>
                );
            })}
        </div>
    );
}
