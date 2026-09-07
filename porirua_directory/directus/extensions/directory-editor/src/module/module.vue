<template>
  <private-view title="Directory">
    <template #title-outer:prepend>
      <v-icon name="domain" large />
    </template>

    <div class="directory-editor">
      <div class="status-band" role="navigation" aria-label="Directory status">
        <button
          type="button"
          class="band"
          :class="{ zero: !queue.length }"
          :disabled="!queue.length"
          @click="openReviewOrNeeds"
        >
          {{ reviewBandLabel }}
        </button>
        <button
          type="button"
          class="band"
          :class="{ zero: !hasUnpublished }"
          :disabled="!hasUnpublished || publishing"
          @click="publishCatalog"
        >
          {{ waitingBandLabel }}
        </button>
        <button
          v-if="canUndoPublish"
          type="button"
          class="band band-action"
          :disabled="undoingPublish"
          @click="undoLastPublish"
        >
          Undo last publish
        </button>
      </div>
      <p v-if="canUndoPublish && queue.length" class="hint sync-note">
        Government updates arrived after you published. Undo publish only changes the public site.
      </p>

      <div class="editor-tabs" role="tablist">
        <button
          id="tab-needs"
          type="button"
          role="tab"
          :aria-selected="tab === 'needs'"
          :aria-controls="tab === 'listings' ? undefined : 'work-panel'"
          :class="{ active: tab === 'needs' }"
          @click="openNeeds"
        >
          {{ needsTabLabel }}
        </button>
        <button
          id="tab-review"
          type="button"
          role="tab"
          :aria-selected="tab === 'review'"
          :aria-controls="tab === 'listings' ? undefined : 'work-panel'"
          :class="{ active: tab === 'review' }"
          @click="openReview"
        >
          {{ reviewTabLabel }}
        </button>
        <button
          id="tab-listings"
          type="button"
          role="tab"
          :aria-selected="tab === 'listings'"
          aria-controls="listings-panel"
          :class="{ active: tab === 'listings' }"
          @click="openListingsTab"
        >
          Listings
        </button>
      </div>

      <div v-if="toast" class="toast" role="status">
        <v-button v-if="toast.undoPublish" small ref="undoBtn" @click="undoLastPublish">Undo publish</v-button>
        <v-button v-else-if="toast.undoId" small ref="undoBtn" @click="undoLast">Undo</v-button>
        <span>{{ toast.message }}</span>
      </div>

      <section
        v-if="tab === 'needs' || tab === 'review'"
        id="work-panel"
        class="panel"
        role="tabpanel"
        :aria-labelledby="tab === 'needs' ? 'tab-needs' : 'tab-review'"
        tabindex="-1"
        ref="workPanel"
      >
        <p v-if="queueError" class="error">{{ queueError }}</p>
        <p v-if="queueLoading" class="hint">Looking for government updates…</p>

        <section v-if="recent.length" class="recent" aria-labelledby="recent-finished-heading">
          <h2 id="recent-finished-heading" class="heading">Recently finished</h2>
          <ul>
            <li v-for="row in visibleRecent" :key="row.id">
              <strong>{{ row.name }}</strong>
              <span>{{ row.decisionLabel }}</span>
              <span class="kind">{{ row.whenLabel }}</span>
              <button
                v-if="row.organizationId"
                type="button"
                class="other-toggle"
                @click="openFinishedListing(row)"
              >
                {{ row.listingLabel }}
              </button>
            </li>
          </ul>
          <button
            v-if="recent.length > 5"
            type="button"
            class="other-toggle"
            @click="showAllRecent = !showAllRecent"
          >
            {{ showAllRecent ? "Show fewer" : `Show all ${recent.length}` }}
          </button>
        </section>

        <div class="review-list">
          <article
            v-for="item in currentTabItems"
            :key="item.id"
            class="review-card"
            :class="{
              'is-correcting': correcting?.id === item.id,
              'is-inert': correcting && correcting.id !== item.id,
            }"
          >
            <button
              type="button"
              class="review-row"
              :aria-expanded="openId === item.id"
              :disabled="Boolean(correcting && correcting.id !== item.id)"
              @click="toggleOpen(item)"
            >
              <strong>{{ item.name || item.title }}</strong>
              <span class="kind">{{ item.summaryLabel || item.kindLabel }}</span>
              <span v-if="item.changedSinceDeferred" class="badge">{{ item.changedSinceDeferredLabel }}</span>
            </button>
            <div v-if="openId === item.id" class="review-body">
              <p v-if="item.fsdReturned" class="banner-note">{{ item.fsdReturnedLabel }}</p>
              <p v-if="item.youSetThis?.length" class="hint">
                You set this earlier: {{ item.youSetThis.map((row) => row.label).join(", ") }}
              </p>
              <ul v-if="item.diffRows?.length" class="diff">
                <li v-for="row in item.diffRows" :key="row.field">{{ row.line }}</li>
              </ul>
              <div v-if="item.otherRows?.length" class="other">
                <button type="button" class="other-toggle" @click="toggleOther(item.id)">
                  {{ shownOther.has(item.id) ? "Hide unchanged details" : "Other details are unchanged. Show them" }}
                </button>
                <ul v-if="shownOther.has(item.id)" class="diff">
                  <li v-for="row in item.otherRows" :key="row.field">{{ row.line }}</li>
                </ul>
              </div>
              <template v-if="correcting?.id !== item.id">
                <verification-bar
                  :website="item.websiteUrl || item.after?.url"
                  :phone="item.phone || item.after?.phone"
                  :address="item.currentAddress || item.before?.address"
                  :address-note="item.verifyAddressNote"
                  :pin="item.verifyPin || item.pin"
                  :compare-pin="item.verifyComparePin"
                  :show-map="item.showVerifyMap"
                />
                <div class="actions" :class="{ equal: item.kind === 'removed' }">
                  <template v-if="item.kind === 'removed'">
                    <v-button small secondary type="button" @click="runQueue(item, '/hide', 'approve')">
                      Take it off the site
                    </v-button>
                    <v-button small secondary type="button" @click="runQueue(item, '/keep-community', 'keep-community')">
                      {{ item.keepAsCommunityLabel }}
                    </v-button>
                  </template>
                  <template v-else>
                    <v-button small @click="runQueue(item, primaryPath(item), 'approve')">
                      {{ item.primaryActionLabel }}
                    </v-button>
                    <v-button
                      v-if="item.kind === 'changed' && item.youSetThis?.length"
                      small
                      secondary
                      @click="runQueue(item, '/keep-curation', 'keep')"
                    >
                      Keep yours
                    </v-button>
                    <v-button
                      v-if="item.kind === 'changed' || item.kind === 'geocode_flag'"
                      small
                      secondary
                      @click="startCorrect(item)"
                    >
                      {{ item.kind === 'geocode_flag' ? "I'll move the pin" : "Use this, and I'll correct it" }}
                    </v-button>
                    <v-button small secondary @click="runQueue(item, '/reject', 'reject')">
                      {{ item.rejectActionLabel }}
                    </v-button>
                  </template>
                  <v-button v-if="!item.deferred" small secondary @click="runQueue(item, '/defer', 'defer')">
                    {{ item.deferActionLabel }}
                  </v-button>
                </div>
              </template>
              <listing-form
                v-if="correcting?.id === item.id"
                :title="correctTitle"
                v-model="form"
                :matches="[]"
                :geo-results="geoResults"
                :help-types="helpTypes"
                :community-groups="communityGroups"
                :highlight="formHighlight"
                :saving="saving"
                :error="formError"
                @lookup-address="lookupAddress"
                @apply-geo="applyGeo"
                @pin-move="onPinMove"
                @save="saveCorrection"
                @cancel="cancelCorrect"
              />
            </div>
          </article>
        </div>

        <div v-if="tab === 'review' && reviewFinished" class="finish">
          <h2 ref="finishHeading" tabindex="-1" class="heading">{{ finishHeading }}</h2>
          <v-button :loading="publishing" :disabled="!hasUnpublished" @click="publishCatalog">
            Publish now
          </v-button>
          <v-button v-if="deferredQueue.length" secondary @click="openNeeds">Keep reviewing later</v-button>
        </div>
        <p v-else-if="tab === 'review' && !activeQueue.length && !queueLoading" class="hint">Nothing to review.</p>
        <p
          v-else-if="tab === 'needs' && !deferredQueue.length && !queueLoading"
          ref="emptyNeeds"
          class="hint"
          tabindex="-1"
        >
          Nothing needs confirmation.
        </p>
      </section>

      <section
        v-else
        id="listings-panel"
        class="panel"
        role="tabpanel"
        aria-labelledby="tab-listings"
      >
        <div v-if="!detail && !formOpen">
          <label class="search">
            Find an organisation
            <input ref="searchInput" v-model="listingSearch" type="search" placeholder="Porirua Whānau Centre" />
          </label>
          <label class="check">
            <input type="checkbox" v-model="showArchived" />
            Show listings that are not on the site
          </label>
          <div class="toolbar">
            <v-button small @click="startCreate('organization')">Add organisation</v-button>
          </div>
          <p v-if="listError" class="error">{{ listError }}</p>
          <p v-if="listLoading" class="hint">Loading organisations…</p>
          <ul class="results">
            <li v-for="row in visibleListings" :key="row.id">
              <button
                type="button"
                class="result"
                :class="{ 'not-on-site': row.status !== 'published' }"
                @click="openDetail(row.id)"
              >
                <strong>{{ row.name }}</strong>
                <span>{{ row.address }}</span>
                <span class="status" :class="{ 'status-off': row.status !== 'published' }">{{ row.statusLabel }}</span>
              </button>
            </li>
          </ul>
          <p v-if="!visibleListings.length && !listLoading" class="hint">
            No organisation matches that name.
          </p>
        </div>

        <div v-else-if="detail && !formOpen">
          <v-button small secondary @click="closeDetail">Back</v-button>
          <h2 class="heading">{{ detail.organization.name }}</h2>
          <p
            class="hint"
            :class="{ 'status-off': detail.organization.status !== 'published' }"
          >
            {{ detail.organization.statusLabel }}
          </p>
          <verification-bar
            :website="detail.organization.url"
            :phone="detail.organization.phone"
            :address="detail.organization.address"
            :pin="detailPin"
            :show-map="Boolean(detailPin)"
          />
          <ul class="lines">
            <li v-for="line in detail.services" :key="line.id">
              <strong class="line-title">{{ line.title || line.service_name }}</strong>
              <span class="line-status" :class="{ 'status-off': line.status !== 'published' }">{{
                line.statusLabel
              }}</span>
              <div class="actions">
                <v-button small secondary @click="editLine(line)">Edit</v-button>
                <v-button v-if="line.status === 'published'" small secondary @click="askArchive(line)">
                  Archive this service line
                </v-button>
                <v-button v-else small @click="restoreLine(line)">Put it back on the site</v-button>
              </div>
            </li>
          </ul>
          <div class="toolbar">
            <v-button small @click="startCreate('serviceLine')">Add a service line</v-button>
            <v-button small secondary @click="editOrganisation">Edit organisation</v-button>
          </div>
        </div>

        <listing-form
          v-if="formOpen"
          :title="formTitle"
          v-model="form"
          :matches="matches"
          :geo-results="geoResults"
          :help-types="helpTypes"
          :community-groups="communityGroups"
          :highlight="formHighlight"
          :saving="saving"
          :error="formError"
          @check-name="checkName"
          @lookup-address="lookupAddress"
          @apply-geo="applyGeo"
          @pin-move="onPinMove"
          @save="saveForm"
          @cancel="closeForm"
          @open-existing="openDetail"
          @create-anyway="confirmAnyway = true"
        />
      </section>
    </div>

    <v-dialog :model-value="archiveOpen" @update:model-value="archiveOpen = $event">
      <v-card>
        <v-card-title>Take this service off the public site?</v-card-title>
        <v-card-text>
          <p>People will not see this service after you publish.</p>
          <p v-if="archiveAlsoOrg">This is the only public service. Also take the organisation off the site?</p>
        </v-card-text>
        <v-card-actions>
          <v-button secondary @click="archiveOpen = false">Cancel</v-button>
          <v-button @click="confirmArchive(false)">Take this service off the site</v-button>
          <v-button v-if="archiveAlsoOrg" @click="confirmArchive(true)">Take the organisation off too</v-button>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </private-view>
</template>

<script>
import { useApi } from "@directus/extensions-sdk";
import ListingForm from "./listing-form.vue";
import VerificationBar from "./verification-bar.vue";
import { directoryEditorRequest, queueActionUndoId } from "./directory-api.js";
import {
  actionSuccessMessage,
  correctHeading,
  foldSearch,
  landingTab,
  needsConfirmationTabLabel,
  reviewCountLabel,
  reviewDeferredFinishLabel,
  reviewFinishedLabel,
  reviewStatusBandLabel,
  waitingCountLabel,
} from "./copy.js";
import { formHighlightFields } from "./form-highlight.js";

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
  components: { ListingForm, VerificationBar },
  setup() {
    const apiClient = useApi();
    return { apiClient };
  },
  data() {
    return {
      tab: "listings",
      listings: [],
      queue: [],
      recent: [],
      showAllRecent: false,
      publishStatus: { unpublished: false, unpublishedCount: 0, canUndoPublish: false },
      publishing: false,
      undoingPublish: false,
      listError: "",
      queueError: "",
      listLoading: false,
      queueLoading: false,
      listingSearch: "",
      showArchived: false,
      formOpen: false,
      formKind: "organization",
      form: emptyForm(),
      formHighlight: { changed: [], youSetThis: [], focusField: null },
      matches: [],
      confirmAnyway: false,
      geoResults: [],
      saving: false,
      formError: "",
      editingServiceId: null,
      archiveOpen: false,
      archiveAlsoOrg: false,
      archiveServiceId: null,
      reviewedThisSession: 0,
      helpTypes: HELP_TYPES,
      communityGroups: COMMUNITY_GROUPS,
      openId: null,
      detail: null,
      toast: null,
      toastTimer: null,
      correcting: null,
      shownOther: new Set(),
    };
  },
  computed: {
    unpublishedCount() {
      if (typeof this.publishStatus.unpublishedCount === "number") return this.publishStatus.unpublishedCount;
      return this.publishStatus.unpublished ? null : 0;
    },
    reviewBandLabel() {
      return reviewStatusBandLabel(this.queue);
    },
    waitingBandLabel() {
      if (this.unpublishedCount == null) return "Changes waiting to go on the site";
      return waitingCountLabel(this.unpublishedCount);
    },
    hasUnpublished() {
      return this.unpublishedCount == null ? Boolean(this.publishStatus.unpublished) : this.unpublishedCount > 0;
    },
    canUndoPublish() {
      return this.publishStatus.canUndoPublish === true;
    },
    reviewTabLabel() {
      const n = this.activeQueue.length;
      return n ? `Review (${n})` : "Review";
    },
    needsTabLabel() {
      return needsConfirmationTabLabel(this.deferredQueue.length);
    },
    activeQueue() {
      return this.queue.filter((item) => !item.deferred);
    },
    deferredQueue() {
      return this.queue.filter((item) => item.deferred);
    },
    currentTabItems() {
      return this.tab === "needs" ? this.deferredQueue : this.activeQueue;
    },
    nextActiveItem() {
      return this.activeQueue[0] || null;
    },
    nextItemAfterAction() {
      if (this.tab === "needs") return this.deferredQueue[0] || null;
      return this.activeQueue[0] || null;
    },
    visibleRecent() {
      return this.showAllRecent ? this.recent : this.recent.slice(0, 5);
    },
    reviewFinished() {
      return this.activeQueue.length === 0 && this.reviewedThisSession > 0;
    },
    finishHeading() {
      if (this.deferredQueue.length) return reviewDeferredFinishLabel(this.deferredQueue.length);
      return reviewFinishedLabel(this.publishStatus.unpublishedCount || this.reviewedThisSession);
    },
    formTitle() {
      if (this.formKind === "serviceLine") return "Add a service line";
      if (this.formKind === "edit") return "Edit listing";
      return "Add organisation";
    },
    correctTitle() {
      return correctHeading(this.correcting);
    },
    visibleListings() {
      const needle = foldSearch(this.listingSearch);
      return this.listings
        .filter((row) => (this.showArchived ? true : row.status === "published"))
        .filter((row) => !needle || foldSearch(row.name).includes(needle))
        .slice()
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "en", { sensitivity: "base" }));
    },
    detailPin() {
      const org = this.detail?.organization;
      if (org?.lat == null || org?.lng == null) return null;
      return { lat: org.lat, lng: org.lng };
    },
  },
  async mounted() {
    await Promise.all([this.refreshListings(), this.refreshQueue(), this.refreshPublish()]);
    this.tab = landingTab({
      activeCount: this.activeQueue.length,
      deferredCount: this.deferredQueue.length,
    });
    if (this.tab === "review") this.openId = this.activeQueue[0].id;
    else if (this.tab === "needs") this.openId = this.deferredQueue[0].id;
    this.$nextTick(() => {
      if (this.tab === "listings") this.$refs.searchInput?.focus?.();
      else this.focusWorkPanel();
    });
    this.onVisibility = () => {
      if (document.visibilityState === "visible") this.refreshPublish();
    };
    document.addEventListener("visibilitychange", this.onVisibility);
  },
  beforeUnmount() {
    if (this.onVisibility) document.removeEventListener("visibilitychange", this.onVisibility);
  },
  methods: {
    reviewCountLabel,
    async api(path, options = {}) {
      return directoryEditorRequest(this.apiClient, path, options);
    },
    async refreshListings() {
      this.listLoading = true;
      try {
        const data = await this.api("/listings");
        this.listings = data.listings || [];
        this.listError = "";
      } catch (error) {
        this.listError = error.message || "Could not load listings.";
      } finally {
        this.listLoading = false;
      }
    },
    async refreshQueue() {
      this.queueLoading = true;
      try {
        const data = await this.api("/queue");
        this.queue = data.items || [];
        this.recent = data.recent || [];
        this.queueError = "";
      } catch (error) {
        this.queueError = error.message || "Could not load Review.";
      } finally {
        this.queueLoading = false;
      }
    },
    async refreshPublish() {
      try {
        this.publishStatus = await this.api("/publish-status");
      } catch {
        this.publishStatus = { unpublished: false, unpublishedCount: 0, canUndoPublish: false };
      }
    },
    openReviewOrNeeds() {
      if (this.activeQueue.length) this.openReview();
      else if (this.deferredQueue.length) this.openNeeds();
    },
    openReview() {
      this.correcting = null;
      this.tab = "review";
      this.openId = this.activeQueue[0]?.id || null;
      this.focusWorkPanel();
    },
    openNeeds() {
      this.correcting = null;
      this.tab = "needs";
      this.openId = this.deferredQueue[0]?.id || null;
      this.focusWorkPanel();
    },
    openListingsTab() {
      this.correcting = null;
      this.tab = "listings";
    },
    toggleOpen(item) {
      if (this.correcting) return;
      this.openId = this.openId === item.id ? null : item.id;
    },
    cancelCorrect() {
      this.correcting = null;
    },
    focusWorkPanel() {
      this.$nextTick(() => {
        if (this.openId) {
          const row = this.$el.querySelector(".review-card .review-row[aria-expanded='true']");
          if (row) {
            row.focus();
            row.scrollIntoView({ block: "nearest" });
            return;
          }
        }
        const finish = this.$refs.finishHeading;
        if (finish) {
          finish.focus();
          finish.scrollIntoView({ block: "nearest" });
          return;
        }
        const empty = this.$refs.emptyNeeds;
        if (empty) {
          empty.focus();
          return;
        }
        this.$refs.workPanel?.focus?.();
      });
    },
    toggleOther(id) {
      const next = new Set(this.shownOther);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      this.shownOther = next;
    },
    primaryPath(item) {
      return item.kind === "removed" ? "/hide" : "/approve";
    },
    showToast({ message, undoId = null, undoPublish = false, focusUndo = false }) {
      if (this.toastTimer) clearTimeout(this.toastTimer);
      this.toast = { message, undoId, undoPublish };
      if (focusUndo) {
        this.$nextTick(() => {
          const undo = this.$refs.undoBtn;
          const undoEl = undo?.$el || undo;
          undoEl?.focus?.();
        });
      }
      this.toastTimer = setTimeout(() => {
        if (this.toast) {
          this.toast.undoId = null;
          this.toast.undoPublish = false;
        }
      }, 20000);
    },
    focusAfterQueueAction() {
      this.focusWorkPanel();
    },
    async runQueue(item, path, action) {
      try {
        const result = await this.api(path, { method: "POST", body: { keys: [item.id] } });
        this.reviewedThisSession += 1;
        this.correcting = null;
        this.showToast({
          message: actionSuccessMessage({ action, kind: item.kind, unpublished: true }),
          undoId: queueActionUndoId(result),
        });
        await Promise.all([this.refreshQueue(), this.refreshPublish()]);
        this.openId = this.nextItemAfterAction?.id || null;
        this.focusAfterQueueAction();
      } catch (error) {
        this.queueError = error.message || "Could not save that decision. Try again.";
      }
    },
    async undoLast() {
      const undoId = this.toast?.undoId;
      if (this.toastTimer) clearTimeout(this.toastTimer);
      this.toast = null;
      if (!undoId) {
        await Promise.all([this.refreshQueue(), this.refreshPublish()]);
        return;
      }
      try {
        const result = await this.api("/review-undo", { method: "POST", body: { undoId } });
        this.reviewedThisSession = Math.max(0, this.reviewedThisSession - 1);
        await Promise.all([this.refreshQueue(), this.refreshPublish()]);
        this.openId = result.queueItemId || this.nextItemAfterAction?.id || null;
        const restored = this.queue.find((item) => item.id === this.openId);
        if (restored?.deferred) this.tab = "needs";
        else if (restored) this.tab = "review";
        this.focusAfterQueueAction();
      } catch (error) {
        this.queueError = error.message || "Could not undo that.";
        await Promise.all([this.refreshQueue(), this.refreshPublish()]);
      }
    },
    openFinishedListing(row) {
      if (!row?.organizationId) return;
      this.openDetail(row.organizationId);
    },
    startCorrect(item) {
      this.correcting = item;
      this.openId = item.id;
      const after = item.after || {};
      this.form = {
        name: after.name || item.name || "",
        description: after.description || "",
        address: after.address || "",
        phone: after.phone || "",
        url: after.url || "",
        lat: after.lat ?? item.pin?.lat ?? null,
        lng: after.lng ?? item.pin?.lng ?? null,
        categories: after.categories || [],
        communityFilters: [],
      };
      this.formHighlight = formHighlightFields({
        before: item.before || {},
        after,
        locked: (item.youSetThis || []).map((row) => row.field),
      });
      this.formError = "";
      this.$nextTick(() => {
        this.$el.querySelector(".review-card.is-correcting")?.scrollIntoView({ block: "nearest" });
      });
    },
    async saveCorrection() {
      if (!this.correcting) return;
      this.saving = true;
      try {
        const result = await this.api("/edit-and-approve", {
          method: "POST",
          body: { keys: [this.correcting.id], payload: this.form },
        });
        this.reviewedThisSession += 1;
        this.showToast({
          message: actionSuccessMessage({ action: "approve", kind: this.correcting.kind }),
          undoId: queueActionUndoId(result),
        });
        this.correcting = null;
        await Promise.all([this.refreshQueue(), this.refreshPublish()]);
        this.openId = this.nextItemAfterAction?.id || null;
        this.focusAfterQueueAction();
      } catch (error) {
        this.formError = error.message || "Could not save that decision. Try again.";
      } finally {
        this.saving = false;
      }
    },
    async publishCatalog() {
      if (!this.unpublishedCount) return;
      this.publishing = true;
      try {
        await this.api("/publish", { method: "POST", body: {} });
        this.reviewedThisSession = 0;
        await this.refreshPublish();
        this.showToast({
          message: actionSuccessMessage({ action: "publish" }),
          undoPublish: this.canUndoPublish,
          focusUndo: this.canUndoPublish,
        });
      } catch (error) {
        this.queueError = error.message || "Could not publish. Try again.";
      } finally {
        this.publishing = false;
      }
    },
    async undoLastPublish() {
      const expectedVersion = this.publishStatus.currentVersion;
      if (expectedVersion == null) return;
      this.undoingPublish = true;
      try {
        await this.api("/undo-publish", {
          method: "POST",
          body: { expectedVersion },
        });
        this.showToast({ message: actionSuccessMessage({ action: "undo-publish" }) });
        await this.refreshPublish();
      } catch (error) {
        this.queueError = error.message || "Could not undo that publish.";
        await this.refreshPublish();
      } finally {
        this.undoingPublish = false;
      }
    },
    startCreate(kind) {
      this.formKind = kind;
      this.form = emptyForm();
      this.formHighlight = { changed: [], youSetThis: [], focusField: null };
      this.matches = [];
      this.confirmAnyway = false;
      this.editingServiceId = null;
      this.formOpen = true;
    },
    closeForm() {
      this.formOpen = false;
      this.formError = "";
    },
    closeDetail() {
      this.detail = null;
      this.formOpen = false;
    },
    async openDetail(id) {
      this.formOpen = false;
      this.tab = "listings";
      const data = await this.api(`/listings/${encodeURIComponent(id)}`);
      this.detail = data;
    },
    editOrganisation() {
      const org = this.detail.organization;
      this.formKind = "edit";
      this.editingServiceId = null;
      this.form = {
        ...emptyForm(),
        name: org.name || "",
        description: org.description || "",
        address: org.address || "",
        phone: org.phone || "",
        url: org.url || "",
        lat: org.lat ?? null,
        lng: org.lng ?? null,
        communityFilters: org.community_filters || org.communityFilters || [],
      };
      this.formHighlight = {
        changed: [],
        youSetThis: org.youSetThis || [],
        focusField: null,
      };
      this.formOpen = true;
    },
    editLine(line) {
      const org = this.detail.organization;
      this.formKind = "edit";
      this.editingServiceId = line.id;
      this.form = {
        name: line.title || line.service_name || org.name || "",
        description: line.description || "",
        address: line.address || org.address || "",
        phone: line.phone || org.phone || "",
        url: line.url || org.url || "",
        lat: line.lat ?? org.lat ?? null,
        lng: line.lng ?? org.lng ?? null,
        categories: line.categories || [],
        communityFilters: org.community_filters || [],
      };
      this.formHighlight = {
        changed: [],
        youSetThis: [...(line.youSetThis || []), ...(org.youSetThis || [])],
        focusField: null,
      };
      this.formOpen = true;
    },
    async checkName() {
      if (!this.form.name || this.formKind === "edit") return;
      const path =
        this.formKind === "serviceLine" && this.detail
          ? `/listings/name-matches?name=${encodeURIComponent(this.form.name)}&organizationId=${encodeURIComponent(this.detail.organization.id)}`
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
    onPinMove({ lat, lng }) {
      this.form.lat = lat;
      this.form.lng = lng;
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
              organizationId: this.detail.organization.id,
              title: this.form.name,
              confirmCreateAnyway: this.confirmAnyway || this.matches.length === 0,
            },
          });
        } else {
          await this.api("/listings/update", {
            method: "POST",
            body: {
              organizationId: this.detail.organization.id,
              serviceId: this.editingServiceId,
              payload: this.form,
            },
          });
        }
        this.formOpen = false;
        this.showToast({ message: actionSuccessMessage({ action: "save" }) });
        await Promise.all([this.refreshListings(), this.refreshPublish()]);
        if (this.detail) await this.openDetail(this.detail.organization.id);
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
    askArchive(line) {
      const service = line || this.detail?.services?.find((row) => row.id === this.editingServiceId);
      this.archiveServiceId = service?.id || this.editingServiceId;
      const published = (this.detail?.services || []).filter((row) => row.status === "published");
      this.archiveAlsoOrg = published.length <= 1;
      this.archiveOpen = true;
    },
    async confirmArchive(alsoArchiveOrganization) {
      if (!this.archiveServiceId) return;
      this.archiveOpen = false;
      await this.api("/listings/archive", {
        method: "POST",
        body: { serviceId: this.archiveServiceId, alsoArchiveOrganization },
      });
      this.formOpen = false;
      this.showToast({ message: actionSuccessMessage({ action: "archive" }) });
      await Promise.all([this.refreshListings(), this.refreshPublish()]);
      if (this.detail) await this.openDetail(this.detail.organization.id);
    },
    async restoreLine(line) {
      await this.api("/listings/restore", { method: "POST", body: { serviceId: line.id } });
      this.showToast({ message: actionSuccessMessage({ action: "restore" }) });
      await Promise.all([this.refreshListings(), this.refreshPublish()]);
      if (this.detail) await this.openDetail(this.detail.organization.id);
    },
  },
};
</script>

<style scoped>
.directory-editor {
  padding: 16px 24px 48px;
  max-width: 960px;
}
.status-band {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.band {
  border: 1px solid var(--theme--border-color-subdued);
  background: var(--theme--background-normal);
  padding: 10px 14px;
  border-radius: 8px;
  cursor: pointer;
}
.band:disabled,
.band.zero {
  opacity: 0.6;
  cursor: default;
}
.band-action {
  background: transparent;
  border-style: dashed;
}
.toast {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  background: var(--theme--background-normal);
  padding: 10px 14px;
  border-radius: 8px;
  margin: 12px 0;
  position: sticky;
  top: 0;
  z-index: 2;
}
.panel {
  margin-top: 16px;
}
.heading {
  font-size: 1.15rem;
  margin: 8px 0 16px;
}
.hint {
  color: var(--theme--foreground-subdued);
}
.recent {
  margin: 8px 0 20px;
}
.recent .heading {
  margin-bottom: 8px;
}
.recent ul {
  list-style: none;
  padding: 0;
  margin: 0 0 8px;
  display: grid;
  gap: 8px;
}
.recent li {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  align-items: baseline;
}
.error {
  color: var(--danger);
}
.toolbar,
.actions {
  display: flex;
  gap: 8px;
  margin: 12px 0;
  flex-wrap: wrap;
  align-items: center;
}
.actions.equal {
  align-items: stretch;
}
.actions.equal :deep(.v-button) {
  flex: 1 1 0;
}
.editor-tabs {
  display: flex;
  gap: 16px;
  border-bottom: 1px solid var(--theme--border-color-subdued);
  margin-top: 8px;
}
.editor-tabs button {
  background: none;
  border: 0;
  border-bottom: 2px solid transparent;
  padding: 10px 2px 8px;
  cursor: pointer;
  color: var(--theme--foreground-subdued);
}
.editor-tabs button.active {
  color: var(--theme--foreground);
  border-bottom-color: var(--theme--primary);
}
.search {
  display: grid;
  gap: 4px;
  max-width: 420px;
}
.search input {
  padding: 8px;
}
.check {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 12px 0;
}
.results,
.lines,
.diff {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 8px;
}
.result,
.review-row {
  width: 100%;
  text-align: left;
  background: none;
  border: 1px solid var(--theme--border-color-subdued);
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  display: grid;
  gap: 4px;
}
.result.not-on-site {
  background: var(--theme--background-subdued, var(--theme--background-normal));
  border-style: dashed;
  opacity: 0.92;
}
.status-off {
  font-weight: 600;
  color: var(--theme--foreground);
}
.review-card.is-inert {
  opacity: 0.45;
}
.review-card.is-inert .review-row {
  cursor: default;
}
.review-card.is-correcting {
  box-shadow: inset 4px 0 0 var(--theme--primary);
}
.review-card {
  margin-bottom: 12px;
  border: 1px solid var(--theme--border-color-subdued);
  border-radius: 8px;
}
.review-card .review-row {
  border: 0;
  border-radius: 8px 8px 0 0;
}
.review-body {
  padding: 4px 12px 16px;
}
.kind,
.line-status {
  color: var(--theme--foreground-subdued);
}
.lines li {
  display: grid;
  gap: 4px;
}
.badge {
  font-size: 0.85rem;
}
.banner-note {
  font-weight: 600;
}
.finish {
  margin-top: 24px;
  padding: 20px;
  border-radius: 8px;
  background: var(--theme--background-normal);
  display: grid;
  gap: 12px;
  justify-items: start;
}
.deferred {
  margin-top: 32px;
}
.other-toggle {
  background: none;
  border: 0;
  padding: 0;
  color: var(--theme--primary);
  cursor: pointer;
  text-align: left;
}
</style>
