/*
  Blink

  Turns an LED on for one second, then off for one second, repeatedly.

  Most Arduinos have an on-board LED you can control. 
  On the UNO it is attached to digital pin 13

  This example code is modified from.
  https://www.arduino.cc/en/Tutorial/BuiltInExamples/Blink
*/

int intLED = 13;  // define a variable to hold the pin number of the internal LED
int extLED = 12;  // define a variable to hold the pin number of the external LED

// the setup function runs once when you press reset or power the board
void setup() {
  // initialize digital pin LED_BUILTIN as an output.
  Serial.begin(9600);
  pinMode(intLED, OUTPUT);
  pinMode(extLED, OUTPUT);
}

// the loop function runs over and over again forever
void loop() {
  digitalWrite(intLED, HIGH);   // turn the intLED on (HIGH is the voltage level)
  digitalWrite(extLED, LOW);   // turn the extLED off (LOW is the voltage level)
  Serial.println("blink on");
  delay(250);           
              // wait for a second
  digitalWrite(intLED, LOW);    // turn the intLED off by making the voltage LOW
  digitalWrite(extLED, HIGH);   // turn the extLED on by making the voltage HIGH

  Serial.println("blink off");
  delay(250);                       // wait for a second
}
