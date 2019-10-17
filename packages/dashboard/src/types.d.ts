declare module 'vue-dayjs';
declare module 'vue-ls';
declare module 'vue-slider-component';
declare module 'simplebar-vue';
declare module 'keycharm';
declare module "vis-timeline";

declare module '*.json' {
  const value: any;
  export default value;
}

declare interface CopperWindow extends Window {
  VUE_APP_COPPER_LAYER_URL: string;
  VUE_APP_COPPER_SOCKET_SERVER_URL: string;
  VUE_APP_COPPER_LOG_URL: string;
}

// declare function require(path: string): any;
