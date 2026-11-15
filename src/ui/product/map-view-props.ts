// 2D 展开图和 3D 球接收同一组属性，这样总装组件可以无差别地切换两者。
import type { LayerSettings } from "./map-layers";
import type { LatLon } from "./moon-frames";
import type { MapAnnotations } from "./overlay/annotations";
import type { RightPanelSize } from "./panels/panel-shell";

/** 让地图转到某个位置。seq 每次请求加一，用来区分"同一个点再请求一次"。 */
export interface FocusRequest {
  seq: number;
  point: LatLon;
  /** 希望画面里大约能看到多少度的范围。 */
  spanDeg: number;
}

export interface MapViewProps {
  timeMs: number;
  layers: LayerSettings;
  annotations: MapAnnotations;
  focus: FocusRequest | null;
  /** 右边开着的面板（没有就是 null）：3D 球会往左挪、必要时缩小，让整个月球不被面板挡住。2D 图可以自己拖，不处理。 */
  rightPanel?: RightPanelSize | null;
  /** 鼠标在地图上的光标样式（CSS cursor 值）；不写就是十字。 */
  cursor?: string;
  onDoublePick?: (point: LatLon) => void;
  onPick: (point: LatLon) => void;
  onHover: (point: LatLon | null) => void;
  onLoadingChange: (loading: boolean) => void;
  onError: (message: string) => void;
}
