import svgCaptcha from 'svg-captcha';

export const generateCaptcha = () => {
  return svgCaptcha.create({
    size: 5,
    noise: 3,
    color: true,
    background: '#cc9966', 
  });
};
