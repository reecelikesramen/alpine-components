export default function tabs(config = {}) {
    return {
        activeTab: config.initial || 0,
        labels: config.labels || ['Tab 1', 'Tab 2'],

        init() {
            this.$watch('activeTab', () => this.updatePanels());
            this.$nextTick(() => this.updatePanels());
        },

        updatePanels() {
            const panels = this.$el.querySelectorAll('.tab-panels > *');
            panels.forEach((panel, index) => {
                panel.classList.toggle('active', index === this.activeTab);
                panel.classList.add('tab-panel');
            });
        }
    };
}
