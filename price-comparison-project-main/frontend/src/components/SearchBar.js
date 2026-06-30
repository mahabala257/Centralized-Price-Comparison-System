import React, { useState } from "react";

const SearchBar = ({ onSearch }) => {
  const [query, setQuery] = useState("");

  const handleSearch = (e) => {
    e.preventDefault();
    onSearch(query);
  };

  return (
    <form onSubmit={handleSearch} style={{ margin: "20px 0", textAlign: "center" }}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search products..."
        style={{ padding: "10px", width: "300px", borderRadius: "5px" }}
      />
      <button type="submit" style={{ padding: "10px 20px", marginLeft: "10px", borderRadius: "5px", backgroundColor: "#6c63ff", color: "white", border: "none" }}>
        Search
      </button>
    </form>
  );
};

export default SearchBar;