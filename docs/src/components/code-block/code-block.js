export default function codeBlock(config = {}) {
    return {
        language: config.language || 'code',
        copied: false,

        async copy() {
            const code = this.$refs.code.textContent;
            await navigator.clipboard.writeText(code.trim());
            this.copied = true;
            setTimeout(() => this.copied = false, 2000);
        }
    };
}
