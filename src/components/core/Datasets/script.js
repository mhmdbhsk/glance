import { mapState } from 'vuex';

import Controls from 'paraview-glance/src/components/controls';
import ColorGroup from 'paraview-glance/src/components/widgets/ColorGroup';

// ----------------------------------------------------------------------------

export default {
  name: 'Datasets',
  components: {
    ColorGroup,
  },
  data() {
    return {
      datasets: [],
      internalPanelState: {}, // proxyId -> expanded:bool
      subpanels: {}, // proxyId -> subpanels:[bool]
      activeSourceId: -1,
    };
  },
  computed: {
    ...mapState({
      panels: (state) => {
        const priorities = Object.keys(state.panels).map((n) => Number(n));
        priorities.sort((a, b) => a - b);
        return [].concat(...priorities.map((prio) => state.panels[prio]));
      },
    }),
    panelState: {
      get() {
        const ret = [];
        for (let i = 0; i < this.datasets.length; i++) {
          const id = this.datasets[i];
          if (this.internalPanelState[id]) {
            ret.push(i);
          }
        }
        return ret;
      },
      set(newPanelState) {
        for (let i = 0; i < this.datasets.length; i++) {
          const id = this.datasets[i];
          this.internalPanelState[id] = newPanelState.indexOf(i) > -1;
        }
      },
    },
    smallScreen() {
      return this.$vuetify.breakpoint.smAndDown;
    },
  },
  created() {
    Controls.forEach((control, i) => this.addPanel(control, i + 10));
  },
  mounted() {
    this.updateDatasetList();
  },
  proxyManagerHooks: {
    onProxyModified() {
      this.updateDatasetList();
    },
    onProxyCreated({ proxyGroup, proxyName }) {
      if (proxyGroup === 'Sources' && proxyName === 'TrivialProducer') {
        this.updateDatasetList();
      }
    },
    onProxyDeleted({ proxyId, proxyGroup, proxyName }) {
      if (proxyGroup === 'Sources' && proxyName === 'TrivialProducer') {
        const idx = this.datasets.indexOf(proxyId);
        if (idx > -1) {
          this.$delete(this.internalPanelState, proxyId);
          this.$delete(this.subpanels, proxyId);
          this.updateDatasetList();
        }
      }
    },
    onActiveSourceChange(source) {
      if (source) {
        this.activeSourceId = source.getProxyId();
      } else {
        this.activeSourceId = -1;
      }
    },
  },
  methods: {
    updateDatasetList() {
      const sources = this.$proxyManager
        .getSources()
        .filter(
          (s) =>
            s.getProxyGroup() === 'Sources' &&
            s.getProxyName() === 'TrivialProducer'
        )
        .filter((s) => Boolean(s.getDataset()));

      for (let i = 0; i < sources.length; i++) {
        const proxy = sources[i];
        const proxyId = proxy.getProxyId();
        if (!(proxyId in this.internalPanelState)) {
          this.internalPanelState[proxyId] = true;
        }
        if (!(proxyId in this.subpanels)) {
          this.subpanels[proxyId] = Controls.filter((c) => c.visible(proxy))
            .map((c, j) => (c.defaultExpand ? j : -1))
            .filter((v) => v > -1);
        }
      }

      this.datasets = sources.map((s) => s.getProxyId());
    },
    getSourceName(sourceId) {
      const proxy = this.$proxyManager.getProxyById(sourceId);
      if (proxy) {
        return proxy.getName();
      }
      return null;
    },
    activateSource(sourceId) {
      const proxy = this.$proxyManager.getProxyById(sourceId);
      if (proxy) {
        proxy.activate();
      }
      return null;
    },
    deleteDataset(sourceId) {
      const proxy = this.$proxyManager.getProxyById(sourceId);
      if (proxy) {
        this.$proxyManager.deleteProxy(proxy);
      }
    },
    getDatasetVisibility(sourceId) {
      const rep = this.$proxyManager
        .getRepresentations()
        .find((r) => r.getInput().getProxyId() === sourceId);
      return rep ? rep.isVisible() : false;
    },
    toggleDatasetVisibility(sourceId) {
      const visible = !this.getDatasetVisibility(sourceId);
      this.$proxyManager
        .getRepresentations()
        .filter((r) => r.getInput().getProxyId() === sourceId)
        .forEach((r) => r.setVisibility(visible));
      // TODO use onProxyModified?
      this.$forceUpdate();
    },
    addPanel(component, priority) {
      this.$store.commit('addPanel', { component, priority });
    },
  },
};
