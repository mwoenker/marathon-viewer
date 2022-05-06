import { mapdiff } from './mapdiff';
import { rawdiff } from './rawdiff';
import { exportMap } from './exportMap';
import { analyzeSourcemap } from './analyzeSourcemap';

type Command = (args: string[]) => Promise<void>

const commands: Record<string, Command> = {
    mapdiff,
    rawdiff,
    exportMap,
    analyzeSourcemap
};

function usage(): never {
    const commandNames = Object.keys(commands).join('|');
    console.error(`usage: ${process.argv.join(' ')} [${commandNames}]`);
    process.exit(1);
}

async function main() {
    if (process.argv.length <= 2) {
        usage();
    } else {
        const commandName = process.argv[2];
        if (commandName in commands) {
            await commands[commandName](process.argv.slice(3));
        } else {
            usage();
        }
    }
}

main()
    .then(() => {
        process.exit(0);
    })
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });
