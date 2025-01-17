import { ActionTree, MutationTree, GetterTree } from "vuex";
import { RootState } from "./index";
import { UserChoiceInfo } from "../../Interfaces/user";
import { CategoryStageInfo } from "../../Interfaces/category";
import { BeatmapsetInfo } from "../../Interfaces/beatmap";
import { Vote } from "../../Interfaces/vote";
import { Nomination } from "../../Interfaces/nomination";
import { StageQuery } from "../../Interfaces/queries";

export type SectionCategory = "beatmaps" | "users" | "";
export type StageType = "nominating" | "voting";

interface StageState {
    selected: boolean;
    section: SectionCategory,
    categories: CategoryStageInfo[];
    selectedCategory: CategoryStageInfo | null;
    nominations: Nomination[];
    votes: Vote[];
    stage: StageType;
    count: number;
    beatmaps: BeatmapsetInfo[];
    users: UserChoiceInfo[];
    query: StageQuery;
    favourites: boolean;
    played: boolean;
    loading: boolean;
    showVoteChoiceBox: boolean;
}

export const state = (): StageState => ({
    selected: false,
    section: "",
    selectedCategory: null,
    categories: [],
    nominations: [],
    votes: [],
    stage: "nominating",
    count: 0,
    beatmaps: [],
    users: [],
    query: {
        category: 0,
        option: "",
        order: "ASC",
        text: "",
        skip: 0,
        played: [],
        favourites: [],
    },
    favourites: false,
    played: false,
    loading: true,
    showVoteChoiceBox: false,
});

export const mutations: MutationTree<StageState> = {
    loading (state, bool) {
        state.loading = bool;
    },
    selected (state, bool) {
        state.selected = bool;
    },
    updateStage (state, stage) {
        state.stage = stage;
    },
    updateCategories (state, categories) {
        state.categories = categories || [];
    },
    updateVotes (state, votes) {
        state.votes = votes || [];
    },
    addVote (state, vote) {
        if (vote) {
            state.votes.push(vote);
        }
    },
    addNomination (state, nomination) {
        if (nomination) {
            state.nominations.push(nomination);
        }
    },
    removeNomination (state, nominationId: number) {
        const i = state.nominations.findIndex(n => n.ID === nominationId);

        if (i !== -1) {
            state.nominations.splice(i, 1);
        }
    },
    updateNominations (state, nominations) {
        state.nominations = nominations || [];
    },
    updateCount (state, count) {
        state.count = count || 0;
    },
    updateBeatmaps (state, beatmaps) {
        state.beatmaps = beatmaps || [];
    },
    updateUsers (state, users) {
        state.users = users || [];
    },
    updateSelectedCategory (state, category) {
        state.selectedCategory = category;
    },
    updateSection (state, section) {
        if (state.section !== section) {
            state.section = section;
        }
    },
    updateQuery (state, query) {
        state.query = {
            ...state.query,
            ...query,
        };
    },
    updateFavourites (state, favourites) {
        state.favourites = favourites;
    },
    updatePlayed (state, played) {
        state.played = played;
    },
    reset (state, removeText: boolean) {
        if (removeText) state.query.text = "";
        state.section = "beatmaps";
        state.selectedCategory = null;
        state.beatmaps = [];
        state.users = [];
        state.count = 0;
    },
    toggleVoteChoiceBox (state) {
        state.showVoteChoiceBox = !state.showVoteChoiceBox;
    },
};

export const getters: GetterTree<StageState, RootState> = {
    relatedCandidacies (state): Vote[] | Nomination[] {
        if (!state.selectedCategory) return [];

        const arr = state.stage === "nominating" ? state.nominations : state.votes;

        // Type doesnt here
        return (arr as Vote[]).filter(v => v.category.ID === state.selectedCategory?.id);
    },

    categoriesInfo (state): CategoryStageInfo[] {
        if (state.stage === "voting") {
            return state.categories.map(c => {
                const info = {
                    ...c,
                    count: state.votes.filter(v => v.category.ID === c.id).length,
                };
                info.maxNominations = 100;
                return info;
            });
        }

        return state.categories.map(c => ({
            ...c,
            count: state.nominations.filter(n => n.category.ID === c.id).length,
        }));
    },
};

interface InitialData {
    categories: CategoryStageInfo[];
    nominations: Nomination[];
    votes: Vote[];
}

export const actions: ActionTree<StageState, RootState> = {
    updateStage ({ commit }, stage) {
        commit("updateStage", stage);
    },
    async setInitialData ({ state, commit, rootState }) {
        const { data } = await this.$axios.get<InitialData | { error: string }>(`/api/${state.stage}/${rootState.mca?.year}`);

        if ("error" in data) {
            console.error(data.error);
            this.$router.push("/" + rootState.mca?.year);
            return;
        }

        commit("updateCategories", data.categories);
        commit("updateNominations", data.nominations);
        commit("updateVotes", data.votes);

        if (state.stage === "nominating" && data.nominations?.length && data.nominations.some(n => !n.isValid)) {
            alert("Some nominations were denied, contact a staff member if you already haven't!");
        }
    },
    async updateSelectedCategory ({ commit, dispatch }, category) {
        commit("updateSelectedCategory", category);
        dispatch("search");
    },
    async updateSection ({ commit }, section) {
        commit("updateSection", section);
    },
    async updateQuery ({ commit, dispatch }, query) {
        commit("updateQuery", query);
        dispatch("search");
    },
    async updateFavourites ({ commit, dispatch }, favourites) {
        commit("updateFavourites", favourites);
        dispatch("search");
    },
    async updatePlayed ({ commit, dispatch }, played) {
        commit("updatePlayed", played);
        dispatch("search");
    },
    async search ({ state, commit, rootState }, skipping = false) {
        if (!state.selectedCategory) return;

        let skip = 0;
    
        commit("loading", true);

        if (skipping) {
            if (state.selectedCategory.type === "Users") skip = state.users.length;
            else if (state.selectedCategory.type === "Beatmapsets") skip = state.beatmaps.length;
        }

        const { data } = await this.$axios.get(`/api/${state.stage}/${rootState.mca?.year}/search?mode=${rootState.selectedMode}&category=${state.selectedCategory.id}&option=${state.query.option}&order=${state.query.order}&favourites=${state.favourites}&played=${state.played}&text=${state.query.text}&skip=${skip}`);
        if (data.error)
            return alert(data.error);

        commit("loading", false);

        commit("updateCount", data.count);

        if (!data.list) return;

        if (state.selectedCategory.type === "Users") {
            let users = data.list;
            if (skipping) users = [...state.users, ...data.list];
            commit("updateUsers", users.filter((val, i, self) => self.findIndex(v => v.corsaceID === val.corsaceID) === i));
        } else if (state.selectedCategory.type === "Beatmapsets") {
            let beatmaps = data.list;
            if (skipping) beatmaps = [...state.beatmaps, ...data.list];
            commit("updateBeatmaps", beatmaps.filter((val, i, self) => self.findIndex(v => v.id === val.id) === i));
        }
    },
    reset ({ commit }, removeText = false) {
        commit("reset", removeText);
    },
    async createNomination ({ commit, state }, nomineeId: number) {
        if (!state.selectedCategory) return;

        commit("selected", true);
        
        const { data } = await this.$axios.post(`/api/nominating/create`, {
            categoryId: state.selectedCategory.id,
            nomineeId,
        });

        commit("selected", false);

        if (data.error) {
            alert(data.error);
            return;
        }

        commit("addNomination", data);
    },
    async removeNomination ({ commit, state }, nominationId: number) {
        if (!state.selectedCategory) return;

        commit("selected", true);

        const { data } = await this.$axios.delete(`/api/nominating/${nominationId}`);

        commit("selected", false);

        if (data.error) {
            alert(data.error);
            return;
        }

        if (data.success) {
            commit("removeNomination", nominationId);
        }
    },
    async createVote ({ commit, state }, payload: { nomineeId: number, vote: number }) {
        if (!state.selectedCategory) return;

        commit("selected", true);

        const { data } = await this.$axios.post(`/api/voting/create`, {
            category: state.selectedCategory.id,
            nomineeId: payload.nomineeId,
            choice: payload.vote,
        });

        commit("selected", false);

        if (data.error) {
            alert(data.error);
            return;
        }

        commit("addVote", data);
    },
    async removeVote ({ commit, dispatch }, voteId: number) {
        if (!confirm("Do you want to remove this vote? This will move your votes up by 1")) {
            return;
        }

        commit("selected", true);

        const { data } = await this.$axios.delete(`/api/voting/${voteId}`);

        commit("selected", false);

        if (data.error) {
            alert(data.error);
            return;
        }

        if (data.success) {
            await dispatch("setInitialData");
        }
    },
    async swapVotes ({ dispatch }, newOrder: Vote[]) {
        const { data } = await this.$axios.post(`/api/voting/swap`, newOrder);

        if (data.error) {
            alert(data.error);
            return;
        }

        if (data.success) {
            alert(data.success);
            await dispatch("setInitialData");
        }
    },
};
