import { createCanvas } from "canvas"
import Chart from "chart.js/auto"
import { EventMetric, EventParticipantData, eventTimeseries } from "./database.js"

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

function processedTimeseries(start: number, end: number, metric: EventMetric, username: string) {
  const rawTimeseries = eventTimeseries(start, end, metric, username)
  return rawTimeseries.map((obj) => {
    return {
      x: (obj.timestamp - rawTimeseries[0].timestamp) / 3600000,
      y: ((obj.metric ?? 0) - (rawTimeseries[0].metric ?? 0))
    }
  })
}

export function generateLeaderboardPlot(start: number, end: number, metric: EventMetric, eventData: EventParticipantData[]) {
  let shortResults = eventData
  const plotData = shortResults.map((data, index) => {
    return {
      label: `${data.username}`,
      data: processedTimeseries(start, end, metric, data.username),
      fill: false,
      borderColor: getColorFromIndex(index),
      pointBackgroundColor: getColorFromIndex(index),
      borderWidth: (index < 5) ? 2 : 1,
      tension: 0.1,
      showLine: true
    }
  })
  const canvas = createCanvas(300, 150)
  const chart = new Chart(canvas.getContext("2d"), {
    type: "scatter",
    data: {
      datasets: plotData
    },
    options: {
      plugins: {
        legend: {
          display: true,
          labels: {
            usePointStyle: true,
            font: {
              size: 10
            },
            filter: function(legendItem, data) {
              let label = data.datasets[legendItem.datasetIndex!].label || ''
              if (typeof(label) !== 'undefined') {
                  if (legendItem.datasetIndex! >= 5){
                      return false
                  }
              }
              return true
            }
          }
        }
      },
        devicePixelRatio: 2,
        scales: {
          x: {
            title: {
              display: true,
              text: 'Time / hours'
            }
          },
            y: {
                beginAtZero: true
            }
        },
        elements: {
          point:{
              radius: 0
          }
      }
      
    }
  })
  return canvas.toBuffer("image/png", {
    compressionLevel: 6,
    filters: canvas.PNG_ALL_FILTERS,
    palette: undefined,
    backgroundIndex: 0,
    resolution: 600
  })
}

