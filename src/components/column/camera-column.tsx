import { CameraFeed } from "../camera-feed";

export function CameraColumn() {
  return <div className=" p-4 border-r border-white-500 gap-4">
    <CameraFeed />
    <CameraFeed cameraIndex={1} />
  </div>
}
