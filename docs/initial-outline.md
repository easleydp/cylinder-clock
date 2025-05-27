# 3D Rotating Cylinder Clock

Help me create a detailed technical specification for a JavaScript library that renders a **3D rotating cylinder clock** to a div element in a web page. The clock face is a rotating horizontal cylinder. The rendered clock should fill the target div. Typical dimensions of the div are 3:1 (so the cylinder length will typically be 3 times the cylinder diameter). Text rendered on the surface of the cylinder tells the time in British English, e.g. "12 minutes past 10". The direction of rotation is such that, from the viewer's perspective, the text scrolls upwards. There is a line of text telling the time for each minute. The text for the time one minute hence (e.g. "13 minutes past 10") can be seen rotating up into view at the bottom edge of the cylinder. The text for what the time was one minute earlier (e.g. "11 minutes past 10") can be seen rotating out of view at the top edge of the cylinder.

A graphical mockup is below. Note, however, that this mockup is imperfect in that it depicts the cylinder looking 'flat' rather than curved/3D. The requirement is for a realistic looking cylinder that looks curved with text that appears to be wrapped onto its surface.
![mockup](./initial-outline-mockup.png)

Notice in the mockup the black and red markings on the left and right sides of the cylinder.

1. The black marks, like the text, are part of the cylinder and so rotate with it. There are twelve marks every minute (i.e. one every 5 seconds) and the minute markers (coincident with a line of text) are larger than the eleven intermediate marks.
2. The translucent red lines are separate from and in front of the cylinder. They don't move. They serve to index (point at) the current time on the cylinder behind. The idea is that, taken in conjunction with the black marks (1), they're analogous to a red second hand sweeping round a traditional analogue clock dial.
