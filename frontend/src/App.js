import "@/App.css";
import { HashRouter, Routes, Route } from "react-router-dom";
import TabRadarPreview from "@/pages/TabRadarPreview";

function App() {
  return (
    <div className="App">
      <HashRouter>
        <Routes>
          <Route path="/" element={<TabRadarPreview />} />
        </Routes>
      </HashRouter>
    </div>
  );
}

export default App;
