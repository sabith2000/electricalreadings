import React from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

const UsageChart = ({ data }) => {
  return (
    <div>
      <h2>Usage Over Time</h2>
      <LineChart width={500} height={300} data={data}>
        <XAxis dataKey="timestamp" />
        <YAxis />
        <Tooltip />
        <CartesianGrid stroke="#eee" />
        <Line type="monotone" dataKey="reading" stroke="#8884d8" />
      </LineChart>
    </div>
  );
};

export default UsageChart;
