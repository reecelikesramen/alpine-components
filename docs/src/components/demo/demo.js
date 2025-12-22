export default function demo(params = {}) {
    return {
        showSource: false,
        copied: false,

        async copy() {
            const source = this.$refs.source.textContent;
            await navigator.clipboard.writeText(source.trim());
            this.copied = true;
            setTimeout(() => this.copied = false, 2000);
        }
    };
}

