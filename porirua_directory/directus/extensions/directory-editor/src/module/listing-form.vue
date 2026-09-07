<template>
  <div class="form">
    <h2>{{ title }}</h2>
    <label :class="{ marked: isChanged('name') }" data-field="name">
      Name
      <span v-if="isChanged('name')" class="mark">Changed in this update</span>
      <span v-if="youSet('name')" class="mark">You set this earlier</span>
      <input ref="nameInput" v-model="local.name" @blur="$emit('check-name')" />
    </label>
    <div v-if="matches.length" class="matches">
      <p>An organisation with a similar name is already in the directory.</p>
      <ul>
        <li
          v-for="match in matches"
          :key="match.id"
          :class="{ 'not-on-site': match.status && match.status !== 'published' }"
        >
          <strong>{{ match.name }}</strong>
          <span>{{ match.address }} {{ match.phone }}</span>
          <span v-if="match.statusLabel" :class="{ 'status-off': match.status && match.status !== 'published' }">{{
            match.statusLabel
          }}</span>
          <v-button small @click="$emit('open-existing', match.id)">Open the existing one</v-button>
        </li>
      </ul>
      <v-button small secondary @click="$emit('create-anyway')">Create anyway</v-button>
    </div>
    <label :class="{ marked: isChanged('description') }" data-field="description">
      Description
      <span v-if="isChanged('description')" class="mark">Changed in this update</span>
      <textarea v-model="local.description" rows="4" />
    </label>
    <label :class="{ marked: isChanged('address') }" data-field="address">
      Address
      <span v-if="isChanged('address')" class="mark">Changed in this update</span>
      <span v-if="youSet('address') || youSet('lat')" class="mark">You set this earlier</span>
      <input v-model="local.address" @blur="$emit('lookup-address')" />
    </label>
    <ul v-if="geoResults.length" class="matches">
      <li v-for="result in geoResults" :key="result.label">
        <button type="button" @click="$emit('apply-geo', result)">{{ result.label }}</button>
      </li>
    </ul>
    <pin-map
      v-if="!tilesFailed"
      :lat="local.lat"
      :lng="local.lng"
      draggable
      @move="$emit('pin-move', $event)"
      @tiles-failed="tilesFailed = true"
    />
    <p class="hint">Search an address, then drag the pin if the place is wrong. You can save an address with no pin.</p>
    <label :class="{ marked: isChanged('phone') }" data-field="phone">
      Phone
      <span v-if="isChanged('phone')" class="mark">Changed in this update</span>
      <span v-if="youSet('phone')" class="mark">You set this earlier</span>
      <input v-model="local.phone" />
    </label>
    <label :class="{ marked: isChanged('url') }" data-field="url">
      Website
      <span v-if="isChanged('url')" class="mark">Changed in this update</span>
      <span v-if="youSet('url')" class="mark">You set this earlier</span>
      <input v-model="local.url" />
    </label>
    <fieldset :class="{ marked: isChanged('categories') }" data-field="categories">
      <legend>
        Help types
        <span v-if="isChanged('categories')" class="mark">Changed in this update</span>
        <span v-if="youSet('categories')" class="mark">You set this earlier</span>
      </legend>
      <label v-for="option in helpTypes" :key="option.id" class="check">
        <input type="checkbox" :value="option.id" v-model="local.categories" />
        {{ option.label }}
      </label>
    </fieldset>
    <fieldset>
      <legend>Community groups</legend>
      <label v-for="option in communityGroups" :key="option.id" class="check">
        <input type="checkbox" :value="option.id" v-model="local.communityFilters" />
        {{ option.label }}
      </label>
    </fieldset>
    <div class="actions">
      <v-button :loading="saving" @click="$emit('save')">Save</v-button>
      <v-button secondary @click="$emit('cancel')">Cancel</v-button>
    </div>
    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>

<script>
import PinMap from "./pin-map.vue";

export default {
  components: { PinMap },
  props: {
    title: { type: String, required: true },
    modelValue: { type: Object, required: true },
    matches: { type: Array, default: () => [] },
    geoResults: { type: Array, default: () => [] },
    helpTypes: { type: Array, required: true },
    communityGroups: { type: Array, required: true },
    highlight: { type: Object, default: () => ({ changed: [], youSetThis: [], focusField: null }) },
    saving: { type: Boolean, default: false },
    error: { type: String, default: "" },
  },
  emits: [
    "update:modelValue",
    "check-name",
    "lookup-address",
    "apply-geo",
    "pin-move",
    "save",
    "cancel",
    "open-existing",
    "create-anyway",
  ],
  data() {
    return { tilesFailed: false };
  },
  computed: {
    local: {
      get() {
        return this.modelValue;
      },
      set(value) {
        this.$emit("update:modelValue", value);
      },
    },
  },
  mounted() {
    this.focusChanged();
  },
  methods: {
    isChanged(field) {
      return (this.highlight.changed || []).some((row) => row.field === field);
    },
    youSet(field) {
      return (this.highlight.youSetThis || []).some(
        (row) => row.field === field || (row.label === "Map pin" && field === "address")
      );
    },
    focusChanged() {
      const field = this.highlight.focusField;
      this.$nextTick(() => {
        const root = this.$el;
        const target = field ? root.querySelector(`[data-field="${field}"] input, [data-field="${field}"] textarea`) : null;
        (target || this.$refs.nameInput)?.focus?.();
        target?.scrollIntoView?.({ block: "center" });
      });
    },
  },
};
</script>

<style scoped>
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
.marked {
  box-shadow: inset 4px 0 0 currentColor;
  padding-left: 10px;
}
.mark {
  font-size: 0.85rem;
  color: var(--theme--foreground);
  font-weight: 600;
}
.hint {
  color: var(--theme--foreground);
  margin: 0;
}
.error {
  color: var(--danger);
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
.matches .not-on-site {
  border-left: 4px dashed var(--theme--foreground-subdued);
  padding-left: 10px;
}
.status-off {
  font-weight: 600;
}
.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
