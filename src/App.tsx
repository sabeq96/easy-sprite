import { useState } from "react";

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="App">
      <Button onClick={() => setCount(count + 1)} />
      <p>{count}</p>
    </div>
  );
}

export default App;
