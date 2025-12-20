export default function installTicker(options = {}) {
    const config = {
        commands: [
            'npm install alpine-components',
            'pnpm add alpine-components',
            'yarn add alpine-components'
        ],
        intervalMs: 2600,
        ...options
    };

    return {
        commands: config.commands,
        intervalMs: config.intervalMs,
        index: 0,
        _timer: null,

        init() {
            if (!Array.isArray(this.commands)) return;
            if (this.commands.length <= 1) return;

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
            if (!Array.isArray(this.commands)) return;
            if (!this.commands.length) return;
            this.index = (this.index + 1) % this.commands.length;
        }
    };
}

