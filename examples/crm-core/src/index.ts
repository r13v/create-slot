export { CRM_PLUGINS, describeCatalog } from "./catalog"
export {
  DEALS,
  type Deal,
  isClosed,
  money,
  nextStage,
  STAGE_WEIGHT,
  STAGES,
  STALE_AFTER_DAYS,
  type Stage,
  weighted,
} from "./data"
export type { Command, CrmApi, CrmPlugin, DealView } from "./plugin"
export {
  CrmRuntime,
  type CrmStore,
  createCrmStore,
  createPluginStores,
  useCatalog,
  useCommands,
  useCrmApi,
  useDealViews,
  usePluginStore,
  useViewConflicts,
} from "./runtime"
export {
  DashboardWidgets,
  DealActions,
  DealPanels,
  NavItems,
  SettingsSections,
  StatusBar,
} from "./slots"
export {
  type CrmState,
  dealsSlice,
  stageAdvanced,
  stageChanged,
  useCrmDispatch,
  useDeal,
  useDeals,
  usePluginState,
} from "./state"
export { Button, Card, Link, PluginCard, PluginRow, StageTag } from "./ui"
export {
  CrmNav,
  DashboardPage,
  DealPage,
  DealsPage,
  SettingsPage,
} from "./views"
