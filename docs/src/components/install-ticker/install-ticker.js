export default function installTicker(params = {}) {
    const defaultCommands = [
        'npm install alpine-components',
        'pnpm add alpine-components',
        'yarn add alpine-components'
    ];

    const commands = params.commands || defaultCommands;

    return {
        // We append the first item to the end for seamless looping
        commands: [...commands, commands[0]],
        intervalMs: 2600,
        index: 0,
        isTransitioning: true,
        _timer: null,

        init() {
            if (!Array.isArray(this.commands)) return;
            if (this.commands.length <= 2) return; // Need at least 2 + 1 duplicate

            const reduceMotion =
                typeof window !== 'undefined' &&
                typeof window.matchMedia === 'function' &&
                window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            if (reduceMotion) return;

            this._timer = window.setInterval(() => this.next(), this.intervalMs);
        },

        destroy() {
            if (!this._timer) return;
            window.clearInterval(this._timer);
            this._timer = null;
        },

        next() {
            if (!this.isTransitioning) return;
            
            this.index++;

            // If we reached the end (the duplicate of the first item)
            if (this.index === this.commands.length - 1) {
                // Wait for the transition to finish (matching CSS transition time)
                setTimeout(() => {
                    this.isTransitioning = false;
                    this.index = 0;
                    
                    // Force a reflow before re-enabling transition
                    this.$nextTick(() => {
                        // Smallest possible delay to let the browser snap the position
                        setTimeout(() => {
                            this.isTransitioning = true;
                        }, 50);
                    });
                }, 400); // Should match CSS transition duration
            }
        }
    };
}
