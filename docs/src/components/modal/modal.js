const defaultOptions = {
    animationDuration: 400
};

export default function modal(options = {}) {
    const config = { ...defaultOptions, ...options };

    return {
        isOpen: false,
        isOpening: false,
        isClosing: false,

        get trigger() {
            return {
                ['@click']() { this.open() }
            };
        },

        get dialog() {
            return {
                ['x-bind:open']() { return this.isOpen },
                ['@click.self']() { this.close() },
                ['@keydown.escape.window']() { this.close() }
            };
        },

        get closeButton() {
            return {
                ['@click']() { this.close() }
            };
        },

        open() {
            if (this.isOpen) return;
            this.isOpen = true;
            this.isOpening = true;
            this.updateClasses();

            setTimeout(() => {
                this.isOpening = false;
                this.updateClasses();
            }, config.animationDuration);
        },

        close() {
            if (!this.isOpen) return;
            this.isClosing = true;
            this.updateClasses();

            setTimeout(() => {
                this.isOpen = false;
                this.isClosing = false;
                this.updateClasses();
            }, config.animationDuration);
        },

        updateClasses() {
            const html = document.documentElement;
            const isOpenOrClosing = this.isOpen || this.isClosing;

            html.classList.toggle('modal-is-open', isOpenOrClosing);
            html.classList.toggle('modal-is-opening', this.isOpening);
            html.classList.toggle('modal-is-closing', this.isClosing);
        },

        destroy() {
            document.documentElement.classList.remove(
                'modal-is-open',
                'modal-is-opening',
                'modal-is-closing'
            );
        }
    };
}

