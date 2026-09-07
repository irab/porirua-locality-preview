<template>
  <private-view title="Directory">
    <template #title-outer:prepend>
      <v-icon name="domain" large />
    </template>

    <div class="directory-editor">
      <div v-if="publishStatus.unpublished" class="banner">
        Changes are not on the public site yet.
        <v-button small :loading="publishing" @click="publishCatalog">Publish</v-button>
      </div>

      <v-tabs v-model="tab">
        <v-tab value="review">Review</v-tab>
        <v-tab value="listings">Listings</v-tab>
      </v-tabs>

      <section v-if="tab === 'review'" class="panel">
        <p class="lede">These are government (FSD) proposals only. Your own adds never appear here.</p>
        <p v-if="queueError" class="error">{{ queueError }}</p>
        <table v-if="queue.length" class="table">
          <thead>
            <tr>
              <th>Organisation</th>
              <th>Kind</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in queue" :key="item.id">
              <td>
                <strong>{{ item.name || item.title || item.entityId }}</strong>
                <div v-if="item.youSetThis?.length" class="hint">
                  You set {{ item.youSetThis.map((row) => row.label).join(", ") }}
                </div>
              </td>
              <td>{{ item.kind }}</td>
              <td class="actions">
                <v-button small @click="runQueue(item, primaryPath(item), { keys: [item.id] })">
                  {{ item.primaryActionLabel }}
                </v-button>
                <v-button v-if="item.kind === 'changed'" small secondary @click="runQueue(item, '/keep-curation', { keys: [item.id] })">
                  Keep yours
                </v-button>
                <v-button v-if="item.kind !== 'removed'" small secondary @click="runQueue(item, '/reject', { keys: [item.id] })">
                  Reject
                </v-button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="hint">Nothing waiting.</p>
      </section>

      <section v-else class="panel">
        <div class="toolbar">
          <v-button small @click="startCreate('organization')">Add organisation</v-button>
          <v-button small secondary @click="startCreate('serviceLine')" :disabled="!selectedId">
            Add service line
          </v-button>
        </div>
        <p v-if="listError" class="error">{{ listError }}</p>
        <table class="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Address</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in listings"
              :key="row.id"
              :class="{ selected: selectedId === row.id }"
              @click="openListing(row.id)"
            >
              <td>{{ row.name }}</td>
              <td>{{ row.address }}</td>
              <td>{{ row.status }}</td>
            </tr>
          </tbody>
        </table>

        <div v-if="formOpen" class="form">
          <h2>{{ formTitle }}</h2>
          <label>
            Name
            <input v-model="form.name" @blur="checkName" />
          </label>
          <div v-if="matches.length" class="matches">
            <p>An organisation with a similar name is already in the directory.</p>
            <ul>
              <li v-for="match in matches" :key="match.id">
                <strong>{{ match.name }}</strong>
                <span>{{ match.address }} {{ match.phone }}</span>
                <span v-if="match.status !== 'published'">{{ match.status }}</span>
                <v-button small @click="openListing(match.id)">Open the existing one</v-button>
              </li>
            </ul>
            <v-button small secondary @click="confirmAnyway = true">Create anyway</v-button>
          </div>
          <label>
            Description
            <textarea v-model="form.description" rows="4" />
          </label>
          <label>
            Address
            <input v-model="form.address" @blur="lookupAddress" />
          </label>
          <ul v-if="geoResults.length" class="matches">
            <li v-for="result in geoResults" :key="result.label">
              <button type="button" @click="applyGeo(result)">{{ result.label }}</button>
            </li>
          </ul>
          <p v-if="form.lat != null" class="hint">
            Pin {{ form.lat }}, {{ form.lng }}
            <button type="button" @click="nudge(0, 0.0003)">N</button>
            <button type="button" @click="nudge(0, -0.0003)">S</button>
            <button type="button" @click="nudge(-0.0003, 0)">W</button>
            <button type="button" @click="nudge(0.0003, 0)">E</button>
          </p>
          <label>
            Phone
            <input v-model="form.phone" />
          </label>
          <label>
            Website
            <input v-model="form.url" />
          </label>
          <fieldset>
            <legend>Help types</legend>
            <label v-for="option in helpTypes" :key="option.id" class="check">
              <input type="checkbox" :value="option.id" v-model="form.categories" />
              {{ option.label }}
            </label>
          </fieldset>
          <fieldset>
            <legend>Community groups</legend>
            <label v-for="option in communityGroups" :key="option.id" class="check">
              <input type="checkbox" :value="option.id" v-model="form.communityFilters" />
              {{ option.label }}
            </label>
          </fieldset>
          <div class="actions">
            <v-button :loading="saving" @click="saveForm">Save</v-button>
            <v-button v-if="editingServiceId" secondary @click="archiveCurrent">
              Archive this service line
            </v-button>
            <v-button secondary @click="formOpen = false">Close</v-button>
          </div>
          <p v-if="formError" class="error">{{ formError }}</p>
        </div>
      </section>
    </div>
  </private-view>
</template>

<script>
const HELP_TYPES = [
  { id: "food", label: "Food / kai" },
  { id: "housing", label: "Housing / a place to stay" },
  { id: "money", label: "Money help" },
  { id: "safety", label: "Feeling unsafe" },
  { id: "support", label: "Support and counselling" },
  { id: "health", label: "Health" },
  { id: "legal", label: "Legal advice" },
  { id: "work", label: "Work and learning" },
  { id: "everyday", label: "Everyday needs" },
];

const COMMUNITY_GROUPS = [
  { id: "marae_iwi", label: "Marae and iwi" },
  { id: "community_groups", label: "Community groups" },
  { id: "councils", label: "Councils and public agencies" },
  { id: "kai_initiatives", label: "Food / Pātaka Kai" },
  { id: "schools", label: "Schools / kura" },
  { id: "other_community", label: "Other community orgs" },
];

function emptyForm() {
  return {
    name: "",
    description: "",
    address: "",
    phone: "",
    url: "",
    lat: null,
    lng: null,
    categories: [],
    communityFilters: [],
  };
}

export default {
  data() {
    return {
      tab: "listings",
      listings: [],
      queue: [],
      publishStatus: { unpublished: false },
      publishing: false,
      listError: "",
      queueError: "",
      selectedId: null,
      formOpen: false,
      formKind: "organization",
      form: emptyForm(),
      matches: [],
      confirmAnyway: false,
      geoResults: [],
      saving: false,
      formError: "",
      editingServiceId: null,
      helpTypes: HELP_TYPES,
      communityGroups: COMMUNITY_GROUPS,
    };
  },
  computed: {
    formTitle() {
      if (this.formKind === "serviceLine") return "Add a service line";
      return this.selectedId && !this.formKind ? "Edit listing" : "Add organisation";
    },
  },
  async mounted() {
    await Promise.all([this.refreshListings(), this.refreshQueue(), this.refreshPublish()]);
    if (this.queue.length) this.tab = "review";
  },
  methods: {
    async api(path, options = {}) {
      const response = await this.$api.transport.request({
        method: options.method || "GET",
        path: `/directory-editor${path}`,
        data: options.body,
        params: options.params,
      });
      return response?.raw || response;
    },
    async refreshListings() {
      try {
        const data = await this.api("/listings");
        this.listings = data.listings || [];
        this.listError = "";
      } catch (error) {
        this.listError = error.message || "Could not load listings";
      }
    },
    async refreshQueue() {
      try {
        const data = await this.api("/queue");
        this.queue = data.items || [];
        this.queueError = "";
      } catch (error) {
        this.queueError = error.message || "Could not load review";
      }
    },
    async refreshPublish() {
      try {
        this.publishStatus = await this.api("/publish-status");
      } catch {
        this.publishStatus = { unpublished: false };
      }
    },
    primaryPath(item) {
      return item.kind === "removed" ? "/hide" : "/approve";
    },
    async runQueue(item, path, body) {
      await this.api(path, { method: "POST", body });
      await Promise.all([this.refreshQueue(), this.refreshPublish()]);
    },
    async publishCatalog() {
      this.publishing = true;
      try {
        await this.api("/publish", { method: "POST", body: {} });
        await this.refreshPublish();
      } finally {
        this.publishing = false;
      }
    },
    startCreate(kind) {
      this.formKind = kind;
      this.form = emptyForm();
      this.matches = [];
      this.confirmAnyway = false;
      this.editingServiceId = null;
      this.formOpen = true;
      if (kind !== "serviceLine") this.selectedId = null;
    },
    async openListing(id) {
      this.selectedId = id;
      this.formKind = "edit";
      const data = await this.api(`/listings/${encodeURIComponent(id)}`);
      const org = data.organization || {};
      const service = (data.services || []).find((row) => row.status === "published") || data.services?.[0] || {};
      this.editingServiceId = service.id || null;
      this.form = {
        name: org.name || "",
        description: org.description || service.description || "",
        address: org.address || service.address || "",
        phone: org.phone || service.phone || "",
        url: org.url || service.url || "",
        lat: org.lat ?? service.lat ?? null,
        lng: org.lng ?? service.lng ?? null,
        categories: service.categories || [],
        communityFilters: org.community_filters || [],
      };
      this.matches = [];
      this.formOpen = true;
    },
    async checkName() {
      if (!this.form.name || this.formKind === "edit") return;
      const path =
        this.formKind === "serviceLine"
          ? `/listings/name-matches?name=${encodeURIComponent(this.form.name)}&organizationId=${encodeURIComponent(this.selectedId)}`
          : `/listings/name-matches?name=${encodeURIComponent(this.form.name)}`;
      const data = await this.api(path);
      this.matches = data.matches || [];
      this.confirmAnyway = this.matches.length === 0;
    },
    async lookupAddress() {
      if (!this.form.address) return;
      const data = await this.api(`/geocode?q=${encodeURIComponent(this.form.address)}`);
      this.geoResults = data.results || [];
    },
    applyGeo(result) {
      this.form.address = result.label;
      this.form.lat = result.lat;
      this.form.lng = result.lng;
      this.geoResults = [];
    },
    nudge(dx, dy) {
      this.form.lat = Number(this.form.lat) + dy;
      this.form.lng = Number(this.form.lng) + dx;
    },
    async saveForm() {
      this.saving = true;
      this.formError = "";
      try {
        if (this.formKind === "organization") {
          await this.api("/listings", {
            method: "POST",
            body: { ...this.form, confirmCreateAnyway: this.confirmAnyway || this.matches.length === 0 },
          });
        } else if (this.formKind === "serviceLine") {
          await this.api("/listings", {
            method: "POST",
            body: {
              ...this.form,
              kind: "serviceLine",
              organizationId: this.selectedId,
              title: this.form.name,
              confirmCreateAnyway: this.confirmAnyway || this.matches.length === 0,
            },
          });
        } else {
          await this.api("/listings/update", {
            method: "POST",
            body: {
              organizationId: this.selectedId,
              serviceId: this.editingServiceId,
              payload: this.form,
            },
          });
        }
        this.formOpen = false;
        await Promise.all([this.refreshListings(), this.refreshPublish()]);
      } catch (error) {
        if (error.status === 409 || error.response?.status === 409) {
          this.matches = error.data?.matches || error.response?.data?.matches || this.matches;
          this.formError = "Open the existing one, or Create anyway.";
        } else {
          this.formError = error.message || "Could not save";
        }
      } finally {
        this.saving = false;
      }
    },
    async archiveCurrent() {
      if (!this.editingServiceId) return;
      const listing = this.listings.find((row) => row.id === this.selectedId);
      const also =
        listing && listing.public_line_count <= 1
          ? window.confirm("This is the only public service. Also take the organisation off the public site?")
          : false;
      await this.api("/listings/archive", {
        method: "POST",
        body: { serviceId: this.editingServiceId, alsoArchiveOrganization: also },
      });
      this.formOpen = false;
      await Promise.all([this.refreshListings(), this.refreshPublish()]);
    },
  },
};
</script>

<style scoped>
.directory-editor {
  padding: 16px 24px 48px;
  max-width: 960px;
}
.banner {
  background: var(--warning-alt);
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 16px;
  display: flex;
  gap: 12px;
  align-items: center;
}
.panel {
  margin-top: 16px;
}
.lede,
.hint {
  color: var(--theme--foreground-subdued);
}
.error {
  color: var(--danger);
}
.table {
  width: 100%;
  border-collapse: collapse;
}
.table th,
.table td {
  text-align: left;
  padding: 8px 6px;
  border-bottom: 1px solid var(--theme--border-color-subdued);
}
.table tr.selected {
  background: var(--theme--background-normal);
}
.table tbody tr {
  cursor: pointer;
}
.toolbar,
.actions {
  display: flex;
  gap: 8px;
  margin: 12px 0;
}
.form {
  margin-top: 24px;
  display: grid;
  gap: 12px;
}
.form label,
.form fieldset {
  display: grid;
  gap: 4px;
}
.form input,
.form textarea {
  padding: 8px;
}
.check {
  display: flex;
  gap: 8px;
  align-items: center;
}
.matches {
  background: var(--theme--background-normal);
  padding: 12px;
  border-radius: 8px;
}
.matches button {
  background: none;
  border: 0;
  color: var(--theme--primary);
  cursor: pointer;
  text-align: left;
}
</style>
