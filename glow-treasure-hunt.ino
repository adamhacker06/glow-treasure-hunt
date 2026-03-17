const int LED_PIN = 9; // PWM pin for external LED (recommended: D9)
const unsigned long BAUD = 115200;

String lineBuffer = "";

void setup() {
  Serial.begin(BAUD);
  pinMode(LED_PIN, OUTPUT);
  analogWrite(LED_PIN, 0);
}

static int clampByte(int v) {
  if (v < 0) return 0;
  if (v > 255) return 255;
  return v;
}

void loop() {
  while (Serial.available() > 0) {
    char c = (char)Serial.read();

    if (c == '\n') {
      lineBuffer.trim();
      if (lineBuffer.length() > 0) {
        int brightness = clampByte(lineBuffer.toInt());
        analogWrite(LED_PIN, brightness);
      }
      lineBuffer = "";
    } else if (c != '\r') {
      lineBuffer += c;
      if (lineBuffer.length() > 16) {
        lineBuffer = "";
      }
    }
  }
}
