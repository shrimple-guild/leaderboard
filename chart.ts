import { GuildEvent } from "GuildEvent"
import { createCanvas } from "canvas"
import Chart from "chart.js/auto"
import { LeaderboardPosition } from "types"

function getColorFromIndex(index: number): string {
  if (index == 0) {
    return "#5378BD"
  } else if (index == 1) {
    return "#CC91B8"
  } else if (index == 2) {
    return "#80CED7"
  } else if (index == 3) {
    return "#DCD982"
  } else if (index == 4) {
    return "#7DC95E"
  } else {
    return "#444444"
  }
}

export function generateLeaderboardPlot(
  event: GuildEvent,
  leaderboard: LeaderboardPosition[],
  metric?: string
) {
  const timeseriesMetric = metric ?? event.metric
  if (timeseriesMetric == undefined) return undefined
  const plotData = leaderboard.slice(0, 10).map((pos, index) => {
    return {
      label: `${pos.username}`,
      data: event
        .getTimeseries(pos.username, pos.cuteName, timeseriesMetric)!
        .map(a => ({
          x: a.time / 3_600_000,
          y: a.value,
        })),
      fill: false,
      borderColor: getColorFromIndex(index),
      pointBackgroundColor: getColorFromIndex(index),
      borderWidth: index < 5 ? 2 : 1,
      tension: 0.1,
      showLine: true,
    }
  })
  const canvas = createCanvas(300, 150)
  const chart = new Chart(canvas.getContext("2d") as any, {
    type: "scatter",
    data: {
      datasets: plotData,
    },
    options: {
      plugins: {
        legend: {
          display: true,
          labels: {
            usePointStyle: true,
            font: {
              size: 10,
            },
            filter: function (legendItem, data) {
              let label = data.datasets[legendItem.datasetIndex!].label || ""
              if (typeof label !== "undefined") {
                if (legendItem.datasetIndex! >= 5) {
                  return false
                }
              }
              return true
            },
          },
        },
      },
      devicePixelRatio: 2,
      scales: {
        x: {
          title: {
            display: true,
            text: "Time / hours",
          },
        },
        y: {
          beginAtZero: true,
        },
      },
      elements: {
        point: {
          radius: 0,
        },
      },
    },
  })
  return canvas.toBuffer("image/png", {
    compressionLevel: 6,
    filters: canvas.PNG_ALL_FILTERS,
    palette: undefined,
    backgroundIndex: 0,
    resolution: 600,
  })
}
