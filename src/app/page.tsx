import { CameraColumn } from '@/components/column';
import VideoAnalysisApp from '@/components/VideoAnalysisApp';

export default function Home() {
  return (
    <main className="container mx-auto h-screen">
      <div className="grid grid-cols-4 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 h-screen">
        <CameraColumn />
        <p>Second</p>
        <p>Third</p>
        <p>Fourth</p>
      </div>
    </main>
  );
}
