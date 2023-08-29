import { ToolState, UpdateState } from '../state';
import { ToolName } from '../state/modes';

export interface ToolPanelProps {
    toolState: ToolState;
    updateState: UpdateState;
}

interface ToolDescription {
    name: ToolName;
    symbol: string;
}

const tools: readonly ToolDescription[] = [
    {
        name: 'select',
        symbol: 'S'
    },
    {
        name: 'draw',
        symbol: 'D'
    },
    {
        name: 'fill',
        symbol: 'F'
    },
    {
        name: 'object',
        symbol: 'O'
    },
];

export function ToolPanel({ toolState, updateState }: ToolPanelProps): JSX.Element {
    return (
        <div className='toolPanel'>
            {tools.map(tool => {
                const className = tool.name === toolState.tool ? 'tool selected' : 'tool';
                return (
                    <div key={tool.name} className={className} onClick={() => updateState({
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
